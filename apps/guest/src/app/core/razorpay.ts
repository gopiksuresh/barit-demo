/* eslint-disable @typescript-eslint/no-explicit-any */
let loader: Promise<any> | null = null;

/** Loads Razorpay Checkout on demand (only when real test keys are configured). */
export function loadRazorpay(): Promise<any> {
  loader ??= new Promise((resolve, reject) => {
    const w = window as any;
    if (w.Razorpay) return resolve(w.Razorpay);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(w.Razorpay);
    s.onerror = () => {
      loader = null;
      reject(new Error('Could not load Razorpay checkout'));
    };
    document.head.appendChild(s);
  });
  return loader;
}
