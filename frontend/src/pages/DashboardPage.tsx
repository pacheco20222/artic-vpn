// src/pages/DashboardPage.tsx

export default function DashboardPage() {
  return (
    <section className="min-h-screen py-10 px-6 lg:px-8 bg-[#F5FAFD]">
      <h1 className="text-3xl font-bold text-blue-900">Welcome to Artic VPN Dashboard</h1>
      <p className="mt-2 text-gray-600">Secure. Simple. Arctic cool.</p>

      {/* Future VPN widgets */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Connection Status</h2>
          <p className="text-sm text-gray-600">You are currently not connected.</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Server List</h2>
          <p className="text-sm text-gray-600">No servers configured yet.</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Activity Logs</h2>
          <p className="text-sm text-gray-600">No recent activity.</p>
        </div>
      </div>
    </section>
  );
}
