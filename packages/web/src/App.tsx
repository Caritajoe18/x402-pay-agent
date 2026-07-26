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

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [hcsTopicId, setHcsTopicId] = useState<string>("");
  const [providers, setProviders] = useState<Provider[]>([]);
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

  useEffect(() => {
    loadAudit();
    fetch("/api/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers || []))
      .catch(() => {});
    const interval = setInterval(loadAudit, 15000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: data.reply || data.error || "No response",
          toolCalls: data.toolCalls,
        },
      ]);
      loadAudit();
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const totalSpend = auditEntries.length;

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

      <div className="grid">
        <div className="card">
          <h3>Payments Made</h3>
          <div className="value">{totalSpend}</div>
          <div className="sub">USDC via x402 micropayments</div>
        </div>
        <div className="card">
          <h3>Providers</h3>
          <div className="value">{providers.length}</div>
          <div className="sub">
            {providers.length > 0
              ? providers.map((p) => `${p.slug} (${p.price})`).join(", ")
              : "loading..."}
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
              <strong>Sign</strong>
              <span>Agent signs USDC TransferTransaction on Hedera</span>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-num">4</div>
            <div className="flow-text">
              <strong>Settle</strong>
              <span>Blocky402 validates &amp; submits to Hedera</span>
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

      <div className="ecosystem-section">
        <h2>Merchant Ecosystem</h2>
        <div className="ecosystem-grid">
          <div className="eco-card">
            <div className="eco-category">AI &amp; Inference</div>
            <div className="eco-items">OpenAI Proxy · Photo Gen APIs</div>
          </div>
          <div className="eco-card">
            <div className="eco-category">Financial</div>
            <div className="eco-items">SaucerSwap · Stripe Proxy · Memejob</div>
          </div>
          <div className="eco-card">
            <div className="eco-category">Oracles &amp; Data</div>
            <div className="eco-items">Pyth Network · Chainlink</div>
          </div>
          <div className="eco-card">
            <div className="eco-category">Identity &amp; Compliance</div>
            <div className="eco-items">Terminal 3 (T3N) · S3 Marketplace</div>
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
                <strong>Algorithmic trading:</strong> "Get me bitcoin price and sentiment"<br />
                <strong>Compliance:</strong> "Tax rates in Germany for digital services"<br />
                <strong>Supply chain:</strong> "Show me verified carbon credits in Brazil"<br />
                <strong>Research:</strong> "Latest headlines on fed rate decisions"<br />
                <strong>Precision Alpha:</strong> "Build me a crypto alpha signal from on-chain data"
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`msg ${msg.role}`}>
                <div className="role">{msg.role === "user" ? "You" : "Agent"}</div>
                <div className="text">{msg.text}</div>
                {msg.toolCalls?.map((tc, j) => (
                  <div key={j} className="tool-call">
                    <div className="tool-name">
                      ⚡ {tc.tool}({tc.input})
                    </div>
                    <div className="tool-result">
                      {JSON.stringify(tc.result).slice(0, 120)}...
                    </div>
                  </div>
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
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Get me the ETH price, or tax rates in Japan..."
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="audit-section">
        <h2>HCS Audit Trail</h2>
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
        x402 on Hedera &mdash; Every payment logged to HCS
      </div>
    </div>
  );
}
