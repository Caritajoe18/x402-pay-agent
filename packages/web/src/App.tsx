import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  toolCalls?: Array<{ tool: string; input: string; result: unknown }>;
}

interface AuditEntry {
  event: string;
  endpoint: string;
  provider?: string;
  price: string;
  timestamp: string;
  consensusTimestamp?: string;
  transactionId?: string;
  hashscanUrl?: string;
  topicId?: string;
}

interface Provider {
  slug: string;
  name: string;
  description: string;
  price: string;
  params: Array<{ name: string; description: string; required: boolean }>;
}

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
}

interface SpendInfo {
  limited: boolean;
  maxSpendUsd: number | null;
  totalSpentUsd: number;
  remainingUsd: number | null;
  report: string;
}

interface ToolCallResult {
  status?: number;
  price?: string;
  url?: string;
  error?: string;
  blockedByPolicy?: boolean;
  spendReport?: string;
  message?: string;
  report?: string;
  data?: { _meta?: { settlement?: { hashscanUrl?: string; transactionId?: string } } };
}

const SUGGESTIONS = [
  "Get the bitcoin price (pay per query)",
  "Buy the ETH gas dataset",
  "Set my max spend to $0.01",
  "What's my spend report?",
  "Buy macro-indicators and defi-tvl",
];

function formatUsd(value: number | null): string {
  if (value === null) return "No cap";
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function parseToolResult(result: unknown): ToolCallResult {
  if (typeof result === "string") {
    try {
      return JSON.parse(result) as ToolCallResult;
    } catch {
      return { error: result };
    }
  }
  return (result as ToolCallResult) || {};
}

function renderToolCall(tc: { tool: string; input: string; result: unknown }) {
  const res = parseToolResult(tc.result);

  if (tc.tool === "fetch_x402_merchant") {
    const settlement = res.data?._meta?.settlement;
    return (
      <div className={`tool-call ${res.blockedByPolicy ? "tool-call-blocked" : ""}`}>
        <div className="tool-name">
          ⚡ fetch_x402_merchant({res.url ? `"${res.url}"` : tc.input})
        </div>
        {res.blockedByPolicy && (
          <div className="tool-status tool-status-blocked">⛔ Blocked by Max Spend Policy</div>
        )}
        {res.status && <div className="tool-status">HTTP {res.status} — paid {res.price}</div>}
        {settlement?.hashscanUrl && (
          <a
            href={settlement.hashscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hashscan-link"
          >
            ↗ Tx
          </a>
        )}
        {res.spendReport && <pre className="tool-report">{res.spendReport}</pre>}
        {res.error && <div className="tool-err">{res.error}</div>}
      </div>
    );
  }

  if (tc.tool === "set_max_spend") {
    return (
      <div className="tool-call">
        <div className="tool-name">⚡ set_max_spend({tc.input})</div>
        <div className="tool-result">{res.message || JSON.stringify(res)}</div>
      </div>
    );
  }

  if (tc.tool === "get_spend_report") {
    return (
      <div className="tool-call">
        <div className="tool-name">⚡ get_spend_report()</div>
        {res.report && <pre className="tool-report">{res.report}</pre>}
      </div>
    );
  }

  return (
    <div className="tool-call">
      <div className="tool-name">⚡ {tc.tool}({tc.input})</div>
      <div className="tool-result">{JSON.stringify(res).slice(0, 200)}</div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [hcsTopicId, setHcsTopicId] = useState<string>("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceItem[]>([]);
  const [spend, setSpend] = useState<SpendInfo>({
    limited: false,
    maxSpendUsd: null,
    totalSpentUsd: 0,
    remainingUsd: null,
    report: "",
  });
  const [budgetInput, setBudgetInput] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadAudit = async () => {
    try {
      const healthRes = await fetch("/health");
      const health = await healthRes.json();
      const topicId = health.hcsTopicId || health.topicId;
      if (!topicId) return;

      setHcsTopicId(topicId);
      const mirrorRes = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=50&order=desc`
      );
      const data = await mirrorRes.json();
      const entries: AuditEntry[] = (data.messages || []).map(
        (m: Record<string, unknown>) => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(
              new TextDecoder().decode(
                Uint8Array.from(atob(m.message as string), (c) =>
                  c.charCodeAt(0)
                )
              )
            );
          } catch { /* skip */ }
          return {
            event: (parsed.event as string) || "topic_message",
            endpoint: (parsed.url as string) || (parsed.endpoint as string) || "",
            provider: parsed.provider as string | undefined,
            price: parsed.price as string || "",
            timestamp: (m.consensus_timestamp as string) || "",
            consensusTimestamp: m.consensus_timestamp as string,
            transactionId: m.transaction_id as string,
            hashscanUrl: m.transaction_id
              ? `https://hashscan.io/testnet/transaction/${m.transaction_id}`
              : undefined,
            topicId,
          };
        }
      );
      setAuditEntries(entries);
    } catch {
      // silent
    }
  };

  const loadSpend = async () => {
    try {
      const res = await fetch("/api/spend");
      const data = await res.json();
      setSpend(data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadAudit();
    loadSpend();
    fetch("/api/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers || []))
      .catch(() => {});
    fetch("/api/marketplace")
      .then((r) => r.json())
      .then((d) => setMarketplace(d.items || []))
      .catch(() => {});
  }, []);

  const sendMessage = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setLoading(true);

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json();
      const agentText = data.reply || data.error || (data.toolCalls?.length
        ? data.toolCalls.map((tc: { tool: string; result: unknown }) =>
            `${tc.tool}: ${typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2)}`
          ).join("\n\n")
        : "No response");
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: agentText,
          toolCalls: data.toolCalls,
        },
      ]);
      loadAudit();
      loadSpend();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const setBudget = () => {
    const amt = budgetInput.trim();
    if (!amt) return;
    sendMessage(`Set my max spend to $${amt}`);
    setBudgetInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const paymentsCount = auditEntries.filter(
    (e) =>
      e.event === "x402_merchant_purchase" ||
      e.event === "x402_data_purchase" ||
      e.event === "x402_payment"
  ).length;
  const spentPct = spend.limited && spend.maxSpendUsd
    ? Math.min(100, (spend.totalSpentUsd / spend.maxSpendUsd) * 100)
    : 0;

  return (
    <div className="app">
      <header>
        <h1>
          pay<span>-agent</span>
        </h1>
        <p>
          Autonomous AI agent that discovers, pays for, and consumes data from
          x402-protected APIs on Hedera. A universal browser for machine
          commerce &mdash; no subscriptions, no API keys.
          <span className="badge badge-hedera" style={{ marginLeft: 8 }}>
            hedera:testnet
          </span>
          <span className="badge badge-usdc" style={{ marginLeft: 4 }}>
            USDC
          </span>
          <span className="badge badge-policy" style={{ marginLeft: 4 }}>
            Max Spend Policy
          </span>
          {hcsTopicId && (
            <a
              href={`https://hashscan.io/testnet/topic/${hcsTopicId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="badge badge-hcs"
              style={{ marginLeft: 4, textDecoration: "none" }}
            >
              HCS ↗
            </a>
          )}
        </p>
      </header>

      <div className="grid grid-4">
        <div className="card">
          <h3>Payments Made</h3>
          <div className="value">{paymentsCount}</div>
          <div className="sub">USDC via x402 micropayments</div>
        </div>
        <div className="card">
          <h3>Budget Spent</h3>
          <div className="value">{formatUsd(spend.totalSpentUsd)}</div>
          <div className="sub">total USDC paid to merchants</div>
        </div>
        <div className="card">
          <h3>Remaining</h3>
          <div className="value">{formatUsd(spend.remainingUsd)}</div>
          <div className="sub">
            {spend.limited
              ? `of ${formatUsd(spend.maxSpendUsd)} max budget`
              : "no max spend set — policy inactive"}
          </div>
        </div>
        <div className="card">
          <h3>Marketplace</h3>
          <div className="value">{marketplace.length}</div>
          <div className="sub">
            {marketplace.length > 0
              ? marketplace.map((m) => `${m.id} (${m.price})`).join(", ")
              : "loading..."}
          </div>
        </div>
      </div>

      <div className="budget-section">
        <div className="budget-header">
          <h2>Budget &amp; Spend Policy</h2>
          <div className="budget-controls">
            <input
              className="budget-input"
              type="number"
              min="0"
              step="0.001"
              placeholder="Set max spend (USD)"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              disabled={loading}
            />
            <button className="audit-btn" onClick={setBudget} disabled={loading}>
              Set
            </button>
            <button
              className="audit-btn"
              onClick={() => sendMessage("Clear the max spend limit")}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="budget-card">
          {spend.limited && (
            <div className="budget-bar">
              <div className="budget-fill" style={{ width: `${spentPct}%` }} />
            </div>
          )}
          <div className="budget-legend">
            <span className="legend-label">Max spend</span>
            <strong className="legend-value">{formatUsd(spend.maxSpendUsd)}</strong>
            <span className="legend-sep">·</span>
            <span className="legend-label">Spent</span>
            <strong className="legend-value">{formatUsd(spend.totalSpentUsd)}</strong>
            <span className="legend-sep">·</span>
            <span className="legend-label">Remaining</span>
            <strong className="legend-value">
              {formatUsd(spend.remainingUsd)}
            </strong>
          </div>
          <div className="budget-note">
            A <code>MaxSpendPolicy</code> (Hedera Agent Kit policy) evaluates every{" "}
            <code>fetch_x402_merchant</code> call at the{" "}
            <em>post-parameter-normalization</em> lifecycle stage and blocks any
            purchase that would exceed the budget — <strong>before a payment is signed</strong>.
            Ask the agent to <code>set_max_spend</code> or set it here.
          </div>
        </div>
      </div>

      <div className="catalog-section">
        <h2>Data on Tap</h2>
        <div className="catalog-cols">
          <div className="catalog-col">
            <h3 className="catalog-title">
              Pay-per-Query <span className="catalog-ref">Ref Arch 1</span>
            </h3>
            <div className="catalog-list">
              {providers.map((p) => (
                <div key={p.slug} className="catalog-item">
                  <div className="catalog-main">
                    <div className="catalog-name">{p.name}</div>
                    <div className="catalog-desc">{p.description}</div>
                  </div>
                  <div className="catalog-side">
                    <div className="catalog-price">{p.price}</div>
                    <button
                      className="audit-btn catalog-btn"
                      onClick={() =>
                        sendMessage(`Get me ${p.slug} data (pay per query)`)
                      }
                      disabled={loading}
                    >
                      Query
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="catalog-col">
            <h3 className="catalog-title">
              Premium Marketplace <span className="catalog-ref">Ref Arch 2</span>
            </h3>
            <div className="catalog-list">
              {marketplace.map((m) => (
                <div key={m.id} className="catalog-item">
                  <div className="catalog-main">
                    <div className="catalog-name">
                      {m.name}
                      <span className="catalog-cat">{m.category}</span>
                    </div>
                    <div className="catalog-desc">{m.description}</div>
                  </div>
                  <div className="catalog-side">
                    <div className="catalog-price">{m.price}</div>
                    <button
                      className="audit-btn catalog-btn"
                      onClick={() => sendMessage(`Buy the ${m.name} dataset`)}
                      disabled={loading}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flow-section">
        <h2>The Universal Handshake</h2>
        <div className="flow-steps">
          <div className="flow-step">
            <div className="flow-num">1</div>
            <div className="flow-text">
              <strong>Discover</strong>
              <span>Agent identifies a target merchant endpoint</span>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-num">2</div>
            <div className="flow-text">
              <strong>402</strong>
              <span>Merchant returns HTTP 402 + PaymentRequirements</span>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-num">3</div>
            <div className="flow-text">
              <strong>Policy</strong>
              <span>MaxSpendPolicy checks budget before signing</span>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-num">4</div>
            <div className="flow-text">
              <strong>Sign</strong>
              <span>Agent signs USDC TransferTransaction on Hedera</span>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-num">5</div>
            <div className="flow-text">
              <strong>Receive</strong>
              <span>Data released + logged to HCS audit trail</span>
            </div>
          </div>
        </div>
      </div>

      <div className="chat-section">
        <h2>Agent Chat</h2>
        <div className="chat-box">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-audit">
                Ask the agent to fetch real data &mdash; it pays USDC via x402 on Hedera.
                <br />
                <br />
                <strong>Pay-per-query:</strong> "Get the bitcoin price (pay per query)"<br />
                <strong>Marketplace:</strong> "Buy the ETH gas dataset"<br />
                <strong>Budget:</strong> "Set my max spend to $0.01" then "Buy macro-indicators"<br />
                <strong>Spend report:</strong> "What have I spent so far?"<br />
                <strong>Policy block:</strong> "Set max spend to $0.002, then buy btc-onchain and macro-indicators"
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`msg ${msg.role}`}>
                <div className="role">{msg.role === "user" ? "You" : "Agent"}</div>
                <div className="text">{msg.text}</div>
                {msg.toolCalls?.map((tc, j) => (
                  <div key={j}>{renderToolCall(tc)}</div>
                ))}
              </div>
            ))}
            {loading && (
              <div className="msg agent">
                <div className="role">Agent</div>
                <div className="text">Thinking<span className="loading-dots"></span></div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="suggestion-chip"
                onClick={() => sendMessage(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Set my max spend to $0.01, then buy the ETH gas dataset..."
              disabled={loading}
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="audit-section">
        <div className="audit-header">
          <h2>HCS Audit Trail</h2>
          <div className="audit-actions">
            <button className="audit-btn" onClick={loadAudit}>
              Fetch Audit
            </button>
            {hcsTopicId && (
              <a
                href={`https://hashscan.io/testnet/topic/${hcsTopicId}/messages`}
                target="_blank"
                rel="noopener noreferrer"
                className="audit-btn audit-btn-link"
              >
                View on HashScan ↗
              </a>
            )}
          </div>
        </div>
        <div className="audit-list">
          {auditEntries.length === 0 ? (
            <div className="empty-audit">
              No payments yet. Chat with the agent to see audit entries here.
            </div>
          ) : (
            auditEntries
              .slice()
              .reverse()
              .slice(0, 20)
              .map((entry, i) => (
                <div key={i} className="audit-entry">
                  <div className="event-dot" />
                  <div className="endpoint">
                    {entry.provider || entry.endpoint}
                  </div>
                  <div className="price">{entry.price}</div>
                  {entry.hashscanUrl && (
                    <a
                      href={entry.hashscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hashscan-link"
                      title={entry.transactionId || ""}
                    >
                      ↗ Tx
                    </a>
                  )}
                  <div className="time">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="footer">
        pay-agent &mdash; Autonomous USDC Micropayments for Agentic Commerce &mdash;
        x402 on Hedera &mdash; Every payment logged to HCS &mdash; Max Spend Policy enforced
      </div>
    </div>
  );
}
