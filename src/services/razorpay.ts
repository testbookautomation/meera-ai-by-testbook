let razorpayLoadPromise: Promise<boolean> | null = null;

export function loadRazorpaySdk() {
  if ((window as any).Razorpay) return Promise.resolve(true);

  if (!razorpayLoadPromise) {
    razorpayLoadPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  return razorpayLoadPromise;
}

export async function openRazorpayCheckout(options: Record<string, any>) {
  const loaded = await loadRazorpaySdk();
  if (!loaded) {
    throw new Error("Razorpay SDK failed to load. Are you online?");
  }

  const paymentObject = new (window as any).Razorpay(options);
  paymentObject.open();
  return paymentObject;
}
