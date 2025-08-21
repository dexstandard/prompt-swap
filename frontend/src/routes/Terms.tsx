export default function Terms() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Terms of Use</h2>
      <p>
        PromptSwap is open source software provided "as is" without warranties or
        guarantees of any kind. Use it at your own risk.
      </p>
      <p>
        You are free to review the source code and run your own instance on your
        infrastructure. The code is available at{' '}
        <a
          href="https://github.com/dexstandard/prompt-swap"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          this GitHub repository
        </a>
        .
      </p>
      <p>By using the service you agree that the authors are not liable for any damages.</p>
    </div>
  );
}
