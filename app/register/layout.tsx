export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-br from-blue-50 via-white to-blue-50 px-3 py-4 sm:px-4 sm:py-6"
      dir="rtl"
    >
      {children}
    </div>
  )
}
