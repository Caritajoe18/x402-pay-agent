import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  toolCalls?: Array<{ tool: string; input: string; result: unknown }>;
}

interface AuditEntry {
  event: string;
  endpoint: string;
  price: string;
  timestamp: string;
  consensusTimestamp?: string;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadAudit = async () => {
    try {
      const res = await fetch("/api/audit");
      const data = await res.json();
      setAuditEntries(data.messages || []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadAudit();
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
  const endpoints = [...new Set(auditEntries.map((e) => e.endpoint))];

  return (
    <div className="app">
      <header>
        <h1>pay-agent</h1>
        <p>
          AI data agent on Hedera testnet &mdash; pays per API call via x402
          micropayments
          <span className="badge badge-hedera" style={{ marginLeft: 8 }}>
            hedera:testnet
          </span>
        </p>
      </header>

      <div className="grid">
        <div className="card">
          <h3>Payments Made</h3>
          <div className="value">{totalSpend}</div>
          <div className="sub">via x402 micropayments</div>
        </div>
        <div className="card">
          <h3>Endpoints Used</h3>
          <div className="value">{endpoints.length}</div>
          <div className="sub">
            {endpoints.length > 0
              ? endpoints.slice(0, 3).join(", ")
              : "none yet"}
          </div>
        </div>
      </div>

      <div className="chat-section">
        <h2>Agent Chat</h2>
        <div className="chat-box">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-audit">
                Ask the agent to fetch data — it will pay with HBAR via x402.
                <br />
                Try: "What's the weather in Tokyo?" or "Get me the BTC price"
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
              placeholder="Ask the agent to fetch paid data..."
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
                  <div className="endpoint">{entry.endpoint}</div>
                  <div className="price">{entry.price}</div>
                  <div className="time">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="footer">
        pay-agent &mdash; Hedera x402 Bounty Submission &mdash; Every payment
        logged to HCS
      </div>
    </div>
  );
}
