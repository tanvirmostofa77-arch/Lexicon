type ToastType = 'success' | 'error' | 'info';

export function showToast(message: string, type: ToastType = 'info') {
  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  const toastEl = document.createElement('div');
  toastEl.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in`;
  toastEl.textContent = message;

  document.body.appendChild(toastEl);

  setTimeout(() => {
    toastEl.classList.add('animate-slide-out');
    setTimeout(() => toastEl.remove(), 300);
  }, 3000);
}
