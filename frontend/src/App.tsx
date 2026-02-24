import { useState } from "react";

function App() {
  const [output, setOutput] = useState("");

  async function runCode() {
    const response = await fetch("http://localhost:8080/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "python",
        code: 'print("Hello from CodeArena")',
        stdin: "",
      }),
    });

    const data = await response.json();
    setOutput(data.stdout);
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>CodeArena</h1>
      <button onClick={runCode}>Run</button>
      <pre>{output}</pre>
    </div>
  );
}

export default App;