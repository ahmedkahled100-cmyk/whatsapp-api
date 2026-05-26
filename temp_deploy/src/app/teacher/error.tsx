'use client';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold mb-2">عذراً، حدث خطأ غير متوقع!</h2>
      <p className="text-gray-400 mb-6 max-w-md">نحن نعمل على إصلاح هذا الخلل. يرجى المحاولة مرة أخرى لاحقاً.</p>
      <button
        onClick={() => reset()}
        className="btn-gold py-2 px-6"
      >
        حاول مرة أخرى
      </button>
    </div>
  )
}
