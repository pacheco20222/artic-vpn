import { Fragment, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";

type WGConfig = {
  config_text: string;
  qr_code_data_url: string; // may be empty if backend lacks qrcode[pil]
  allocated_ip: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  config: WGConfig | null;
  serverId: number | null;
  loading?: boolean;
  error?: string | null;
};

export default function WGConfigModal({
  open,
  onClose,
  config,
  serverId,
  loading = false,
  error = null,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleCopy = async () => {
    if (!config?.config_text) return;
    try {
      await navigator.clipboard.writeText(config.config_text);
      alert("Config copied to clipboard");
    } catch {
      // Fallback for older browsers
      try {
        const el = textareaRef.current;
        if (el) {
          el.select();
          document.execCommand("copy");
          alert("Config copied to clipboard");
        }
      } catch {
        alert("Copy failed. Please copy manually.");
      }
    }
  };

  const handleDownload = () => {
    if (!config?.config_text) return;
    const blob = new Blob([config.config_text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ip = (config.allocated_ip || "").replace("/", "_");
    a.download = `artic-wg-server${serverId ?? ""}-${ip}.conf`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        {/* Panel */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="transition ease-out duration-200 transform"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="transition ease-in duration-150 transform"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  WireGuard Config {serverId ? `(Server #${serverId})` : ""}
                </Dialog.Title>

                {/* Loading / Error */}
                {loading && (
                  <p className="mt-4 text-sm text-gray-600">Generating config…</p>
                )}
                {!loading && error && (
                  <p className="mt-4 text-sm text-red-600">{error}</p>
                )}

                {/* Content */}
                {!loading && !error && config && (
                  <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Left: Config text */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Client .conf
                      </label>
                      <textarea
                        ref={textareaRef}
                        className="mt-1 block h-64 w-full rounded-md border border-gray-300 p-2 font-mono text-sm"
                        readOnly
                        value={config.config_text}
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={handleCopy}
                          className="rounded-md bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                        >
                          Copy
                        </button>
                        <button
                          onClick={handleDownload}
                          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                        >
                          Download .conf
                        </button>
                      </div>
                    </div>

                    {/* Right: QR */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Scan in WireGuard (mobile)
                      </label>
                      {config.qr_code_data_url ? (
                        <img
                          src={config.qr_code_data_url}
                          alt="WireGuard QR"
                          className="mt-1 w-full max-w-xs rounded-md border"
                        />
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">
                          QR not available. Ask your admin to install <code>qrcode[pil]</code> on the backend, or copy the config text above.
                        </p>
                      )}
                      {config.allocated_ip && (
                        <p className="mt-3 text-xs text-gray-500">
                          Assigned tunnel IP: <span className="font-mono">{config.allocated_ip}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}