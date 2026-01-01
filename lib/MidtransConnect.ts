import dotenv from "dotenv";
import midtrans from "midtrans-client";
import crypto from "crypto";
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

interface InterfaceMidtransValidateSignature {
   orderId: string;
   statusCode: string;
   grossAmount: string;
   trueSignature: string;
}
export async function MidtransValidateSignature(props: InterfaceMidtransValidateSignature): Promise<boolean> {
   const { orderId, statusCode, grossAmount, trueSignature } = props;
   const serverKey = process.env.MIDTRANS_SERVER_KEY as string;

   const _ = orderId + statusCode + grossAmount + serverKey;
   const hash = crypto.createHash("sha512").update(_).digest("hex");
   if (trueSignature !== hash) return false;
   return true;
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
