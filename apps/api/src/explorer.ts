export const explorerHtml = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <link rel="icon" href="data:," />
    <title>Velobase Ledger Explorer</title>
    <style>
      :root {
        --ink: #f4f2eb;
        --muted: #a6a59f;
        --line: rgba(244, 242, 235, 0.12);
        --panel: rgba(28, 29, 27, 0.82);
        --green: #b7f34d;
        --violet: #a99cff;
        --amber: #ffc66d;
        --red: #ff8c7d;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at 20% 0%, rgba(183, 243, 77, 0.12), transparent 30rem),
          radial-gradient(circle at 90% 20%, rgba(169, 156, 255, 0.11), transparent 28rem),
          #111210;
        color: var(--ink);
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button, input { font: inherit; }

      .shell { width: min(1160px, calc(100% - 32px)); margin: 0 auto; padding-bottom: 72px; }

      nav {
        height: 76px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--line);
      }

      .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; letter-spacing: -0.02em; }
      .mark {
        width: 32px; height: 32px; display: grid; place-items: center;
        border-radius: 9px; color: #111210; background: var(--green); font-weight: 900;
        box-shadow: 0 0 32px rgba(183, 243, 77, 0.22);
      }
      .status { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
      .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 12px var(--green); }

      header { padding: 84px 0 54px; display: grid; grid-template-columns: 1.35fr 0.65fr; gap: 48px; align-items: end; }
      .eyebrow { color: var(--green); font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.12em; text-transform: uppercase; }
      h1 { margin: 18px 0 20px; max-width: 760px; font-size: clamp(45px, 7vw, 84px); line-height: 0.96; letter-spacing: -0.065em; font-weight: 650; }
      .lead { max-width: 650px; margin: 0; color: var(--muted); font-size: 18px; line-height: 1.65; }
      .hero-action { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
      .primary {
        border: 0; border-radius: 999px; background: var(--green); color: #111210;
        padding: 15px 22px; cursor: pointer; font-weight: 750;
        box-shadow: 0 10px 36px rgba(183, 243, 77, 0.18); transition: transform 150ms, box-shadow 150ms;
      }
      .primary:hover { transform: translateY(-2px); box-shadow: 0 14px 42px rgba(183, 243, 77, 0.27); }
      .primary:disabled { opacity: 0.55; cursor: wait; transform: none; }
      .hint { color: var(--muted); font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }

      .flow {
        display: grid; grid-template-columns: repeat(4, 1fr); overflow: hidden;
        border: 1px solid var(--line); border-radius: 18px; background: rgba(17, 18, 16, 0.6);
      }
      .flow-step { padding: 22px; position: relative; border-right: 1px solid var(--line); }
      .flow-step:last-child { border-right: 0; }
      .flow-step span { display: block; color: var(--muted); font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: 0.1em; }
      .flow-step strong { display: block; margin-top: 9px; font-size: 21px; font-weight: 600; }
      .flow-step em { font-style: normal; color: var(--green); }

      .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 54px 0 18px; }
      h2 { margin: 0; font-size: 22px; letter-spacing: -0.03em; }
      .search { display: flex; width: min(460px, 100%); padding: 5px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
      .search input { flex: 1; min-width: 0; padding: 9px 11px; color: var(--ink); background: transparent; border: 0; outline: none; }
      .search button { padding: 8px 13px; color: var(--ink); border: 0; border-radius: 8px; background: rgba(244, 242, 235, 0.1); cursor: pointer; }

      .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .metric { min-height: 132px; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); backdrop-filter: blur(16px); }
      .metric-label { color: var(--muted); font-size: 13px; }
      .metric-value { margin-top: 23px; font: 520 34px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: -0.06em; }
      .metric.available .metric-value { color: var(--green); }

      .ledger { margin-top: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); overflow: hidden; }
      .ledger-head { display: grid; grid-template-columns: 150px 1fr 110px 170px; gap: 16px; padding: 13px 20px; border-bottom: 1px solid var(--line); color: var(--muted); font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.08em; text-transform: uppercase; }
      .entry { display: grid; grid-template-columns: 150px 1fr 110px 170px; gap: 16px; align-items: center; padding: 18px 20px; border-bottom: 1px solid var(--line); }
      .entry:last-child { border-bottom: 0; }
      .operation { display: flex; align-items: center; gap: 10px; font-weight: 650; font-size: 13px; }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
      .dot.reserve { background: var(--violet); }
      .dot.settle { background: var(--amber); }
      .dot.release { background: var(--red); }
      .transaction { overflow: hidden; color: var(--muted); font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .amount { font: 600 14px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .time { color: var(--muted); font-size: 12px; text-align: right; }
      .empty { padding: 50px 20px; color: var(--muted); text-align: center; }
      .error { display: none; margin-top: 12px; padding: 14px 16px; border: 1px solid rgba(255, 140, 125, 0.35); border-radius: 12px; background: rgba(255, 140, 125, 0.08); color: #ffc1b8; font-size: 13px; }

      footer { display: flex; justify-content: space-between; margin-top: 24px; color: var(--muted); font: 11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
      footer a { color: var(--green); text-decoration: none; }

      @media (max-width: 780px) {
        header { grid-template-columns: 1fr; padding-top: 56px; }
        .flow, .metrics { grid-template-columns: repeat(2, 1fr); }
        .flow-step:nth-child(2) { border-right: 0; }
        .flow-step:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
        .toolbar { align-items: flex-start; flex-direction: column; }
        .search { width: 100%; }
        .ledger-head { display: none; }
        .entry { grid-template-columns: 110px 1fr; }
        .entry .time { text-align: left; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <nav>
        <div class="brand"><span class="mark">V</span> Velobase</div>
        <div class="status"><span class="status-dot"></span> Local engine online</div>
      </nav>

      <header>
        <div>
          <div class="eyebrow">Ledger Explorer · localhost</div>
          <h1>Know where every credit went.</h1>
          <p class="lead">Reserve an estimate before expensive AI work begins, settle the actual cost, and explain every balance change without charging twice.</p>
        </div>
        <div class="hero-action">
          <button class="primary" id="run-demo">Run the AI video demo</button>
          <div class="hint">100 reserved · 67 settled · 33 returned</div>
        </div>
      </header>

      <section class="flow" aria-label="Demo lifecycle">
        <div class="flow-step"><span>01 · Grant</span><strong>+100 credits</strong></div>
        <div class="flow-step"><span>02 · Reserve</span><strong>100 held</strong></div>
        <div class="flow-step"><span>03 · Settle</span><strong>67 used</strong></div>
        <div class="flow-step"><span>04 · Release</span><strong><em>33 available</em></strong></div>
      </section>

      <section>
        <div class="toolbar">
          <h2>Customer balance</h2>
          <form class="search" id="search-form">
            <input id="customer-id" aria-label="Customer ID" placeholder="Run the demo or enter a customer ID" />
            <button type="submit">Inspect</button>
          </form>
        </div>

        <div class="metrics">
          <div class="metric"><div class="metric-label">Total granted</div><div class="metric-value" id="total">—</div></div>
          <div class="metric"><div class="metric-label">Used</div><div class="metric-value" id="used">—</div></div>
          <div class="metric"><div class="metric-label">Reserved</div><div class="metric-value" id="reserved">—</div></div>
          <div class="metric available"><div class="metric-label">Available</div><div class="metric-value" id="available">—</div></div>
        </div>

        <div class="error" id="error"></div>
        <div class="ledger">
          <div class="ledger-head"><span>Operation</span><span>Transaction</span><span>Amount</span><span style="text-align:right">Time</span></div>
          <div id="entries"><div class="empty">Run the demo to create an explainable credit lifecycle.</div></div>
        </div>
      </section>

      <footer><span>Tenant: demo / Project: ai-video · <a href="/openapi.json">OpenAPI</a></span><span>Append-only · FEFO · Retry-safe</span></footer>
    </div>

    <script>
      const runButton = document.getElementById("run-demo");
      const searchForm = document.getElementById("search-form");
      const customerInput = document.getElementById("customer-id");
      const errorBox = document.getElementById("error");

      async function request(url, options) {
        const response = await fetch(url, options);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error && body.error.message ? body.error.message : "Request failed");
        return body;
      }

      function setError(error) {
        errorBox.textContent = error ? error.message : "";
        errorBox.style.display = error ? "block" : "none";
      }

      function setMetric(id, value) {
        document.getElementById(id).textContent = new Intl.NumberFormat().format(value);
      }

      function render(balance, ledger) {
        setMetric("total", balance.total);
        setMetric("used", balance.used);
        setMetric("reserved", balance.reserved);
        setMetric("available", balance.available);

        const container = document.getElementById("entries");
        container.replaceChildren();
        if (!ledger.entries.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "No ledger entries found for this customer.";
          container.appendChild(empty);
          return;
        }

        ledger.entries.forEach(function (item) {
          const row = document.createElement("div");
          row.className = "entry";

          const operation = document.createElement("div");
          operation.className = "operation";
          const dot = document.createElement("span");
          dot.className = "dot " + item.operation.toLowerCase();
          const label = document.createElement("span");
          label.textContent = item.operation;
          operation.append(dot, label);

          const transaction = document.createElement("div");
          transaction.className = "transaction";
          transaction.title = item.transactionId;
          transaction.textContent = item.transactionId;

          const amount = document.createElement("div");
          amount.className = "amount";
          amount.textContent = (item.operation === "GRANT" || item.operation === "RELEASE" ? "+" : "−") + item.amount;

          const time = document.createElement("div");
          time.className = "time";
          time.textContent = new Date(item.createdAt).toLocaleString();

          row.append(operation, transaction, amount, time);
          container.appendChild(row);
        });
      }

      async function inspect(customerId, provided) {
        setError(null);
        const data = provided || await Promise.all([
          request("/v1/balances/" + encodeURIComponent(customerId) + "?wallet=video"),
          request("/v1/ledger?customerId=" + encodeURIComponent(customerId) + "&wallet=video"),
        ]).then(function (parts) { return { balance: parts[0], ledger: parts[1] }; });
        render(data.balance, data.ledger);
      }

      runButton.addEventListener("click", async function () {
        runButton.disabled = true;
        runButton.textContent = "Running lifecycle…";
        setError(null);
        try {
          const result = await request("/v1/demo/ai-video", { method: "POST" });
          customerInput.value = result.customerId;
          render(result.balance, result.ledger);
        } catch (error) {
          setError(error);
        } finally {
          runButton.disabled = false;
          runButton.textContent = "Run another AI video demo";
        }
      });

      searchForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const customerId = customerInput.value.trim();
        if (!customerId) return;
        try { await inspect(customerId); } catch (error) { setError(error); }
      });
    </script>
  </body>
</html>`;
