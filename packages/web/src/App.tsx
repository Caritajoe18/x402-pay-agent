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

interface AuditData {
  topicId: string;
  messages: AuditEntry[];
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
      const res = await fetch("/api/audit");
      const data: AuditData = await res.json();
      setAuditEntries(data.messages || []);
      if (data.topicId) setHcsTopicId(data.topicId);
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
          Precision <span>Alpha</span>
        </h1>
        <p>
          Autonomous AI trader that discovers, pays for, and consumes data from
          x402-protected APIs on Hedera. Algorithmic precision meets machine
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
          <h3>Trades Executed</h3>
          <div className="value">{totalSpend}</div>
          <div className="sub">USDC via x402 micropayments</div>
        </div>
        <div className="card">
          <h3>Data Sources</h3>
          <div className="value">{providers.length}</div>
          <div className="sub">
            {providers.length > 0
              ? providers.map((p) => `${p.slug} (${p.price})`).join(", ")
              : "loading..."}
          </div>
        </div>
      </div>

      <div className="flow-section">
        <h2>The Alpha Pipeline</h2>
        <div className="flow-steps">
          <div className="flow-step">
            <div className="flow-num">1</div>
            <div className="flow-text">
              <strong>Scan</strong>
              <span>Agent identifies target data endpoints</span>
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
              <strong>Alpha</strong>
              <span>Data ingested + logged to HCS audit trail</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ecosystem-section">
        <h2>Trading Ecosystem</h2>
        <div className="ecosystem-grid">
          <div className="eco-card">
            <div className="eco-category">Market Data</div>
            <div className="eco-items">Crypto Prices · Order Books · OHLCV</div>
          </div>
          <div className="eco-card">
            <div className="eco-category">Sentiment</div>
            <div className="eco-items">Social Sentiment · News Feeds · Fear/Greed</div>
          </div>
          <div className="eco-card">
            <div className="eco-category">Compliance</div>
            <div className="eco-items">KYC/AML · Tax Rates · Regulatory Data</div>
          </div>
          <div className="eco-card">
            <div className="eco-category">ESG &amp; Macro</div>
            <div className="eco-items">Carbon Credits · On-chain Analytics · Oracles</div>
          </div>
        </div>
      </div>

      <div className="chat-section">
        <h2>Alpha Terminal</h2>
        <div className="chat-box">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-audit">
                Ask the agent for market data &mdash; it pays USDC via x402 on Hedera.
                <br />
                <br />
                <strong>Trading:</strong> "Get me BTC price and ETH sentiment"<br />
                <strong>Macro:</strong> "Fed rate decision impact on crypto"<br />
                <strong>Compliance:</strong> "Tax rates in Germany for digital assets"<br />
                <strong>ESG:</strong> "Verified carbon credit prices in Brazil"<br />
                <strong>Direct:</strong> "Fetch data from any x402-protected API"
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
              placeholder="e.g. BTC price, sentiment analysis, tax rates..."
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
              No trades yet. Chat with the agent to see execution logs here.
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
        Precision Alpha &mdash; Autonomous USDC Trading Agent on Hedera &mdash;
        x402 Micropayments &mdash; Every trade logged to HCS
      </div>
    </div>
  );
}
