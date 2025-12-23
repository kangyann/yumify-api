import dotenv from "dotenv";
import midtrans from "midtrans-client";
dotenv.config();

class MidtransConnect {
   private CoreApi: midtrans.CoreApi;

   constructor({
      isProduction,
      serverKey,
      clientKey,
   }: {
      isProduction: boolean;
      serverKey: string;
      clientKey: string;
   }) {
      this.CoreApi = new midtrans.CoreApi({
         isProduction: isProduction,
         serverKey: serverKey,
         clientKey: clientKey,
      });
   }

   public async Charge(parameter: midtrans.ChargeParameter): Promise<any> {
      try {
         const chargeResponse = await this.CoreApi.charge(parameter);
         return chargeResponse;
      } catch (error) {
         console.log("Midtrans Charge Error:", error);
         return { status: 500, message: error };
      }
   }
}

export default async function MidtransAppRun(params: any): Promise<any> {
   const isProduction = process.env.APP_PRODUCTION === "true",
      serverKey = process.env.MIDTRANS_SERVER_KEY as string,
      clientKey = process.env.MIDTRANS_CLIENT_KEY as string;

   const Connect = new MidtransConnect({ isProduction, serverKey, clientKey });
   const charge = await Connect.Charge(params);

   return charge;
}
/** Example Running Test Pay */
/**
 * 
 * MidtransAppRun({
 * payment_type: "qris",
 * qris: {
 *    acquirer: "gopay",
 * },
 * transaction_details: {
 *    order_id: "KwYxTExST-1w24",
 *    gross_amount: 10000,
 * },
 * });
 * 
 END OF EXAMPLE **/

