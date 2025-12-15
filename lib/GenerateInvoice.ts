export default function GenerateInvoice(): string {
   return "INV-" + Math.random().toString(14).substr(2, 9).toUpperCase();
}
