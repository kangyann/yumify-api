import bcrypt from "bcryptjs";
import express, { Response } from "express";

import PrismaConnect from "../lib/PrismaConnect.js";
import { AppError, InterfaceAppError } from "../lib/AppError.js";
import { TypeLanguage, InterfaceResponseByLanguage, InterfaceUserDatabase } from "../interface/api_auth.js";
import { InterfaceUserCreate } from "../interface/api_create_user.js";
import { connect } from "http2";
import { error } from "console";
import GenerateInvoice from "../lib/GenerateInvoice.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (_req, res) => {
   res.send("Hello Express!");
});

// Route AUTH
app.post("/api/auth", async (req, res): Promise<Response> => {
   if (!req.body || !req.query) {
      return res.status(500).json({ message: "Invalid request." });
   }
   const q: { lang: string } = req.query as { lang: string };

   const { username, password: req_password } = req.body;

   const responseByLanguage: Record<TypeLanguage, InterfaceResponseByLanguage> = {
      id: {
         success_login: "Berhasil masuk.",
         user_nothing: "User tidak ditemukan.",
         wrong_password: "Password anda salah.",
      },
      en: {
         success_login: "Login success.",
         user_nothing: "Can't find that user.",
         wrong_password: "Your password is incorrect.",
      },
   };

   try {
      const finduser: InterfaceUserDatabase = await PrismaConnect.users.findFirstOrThrow({ where: { username } });
      const compare: boolean = await bcrypt.compare(req_password, finduser.password);
      if (!compare) {
         throw new AppError(
            responseByLanguage[q.lang as TypeLanguage].wrong_password,
            "INVALID_PASSWORD"
         ) as InterfaceAppError;
      }
      const { password, id, ...user }: InterfaceUserDatabase = finduser as InterfaceUserDatabase;

      return res.status(200).json({ message: responseByLanguage[q.lang as TypeLanguage].success_login, data: user });
   } catch (error) {
      if (error.code == "P2025") {
         return res.status(404).json({ message: responseByLanguage[q.lang as TypeLanguage].user_nothing });
      }
      if (error.code == "INVALID_PASSWORD") {
         return res.status(401).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal Server Error.", hint: error });
   }
});

// Route Create User
app.post("/api/users/create", async (req, res): Promise<Response> => {
   if (!req.body) {
      return res.status(500).json({ message: "Invalid request." });
   }
   try {
      const { email, name, username, password: req_password } = req.body as InterfaceUserCreate;
      const password: string = await bcrypt.hash(req_password, 10);
      const createuser = await PrismaConnect.users.create({
         data: { email, name, username, password },
         select: { username: true, email: true, createdAt: true },
      });
      return res.status(200).json({ message: "OK", data: createuser });
   } catch (error) {
      return res.status(500).json({ message: "Internal Server Error.", hint: error });
   }
});

// Route Create Product
app.post("/api/product/create", async (req, res): Promise<Response> => {
   if (!req.body) {
      return res.status(500).json({ message: "Invalid request." });
   }
   const data = req.body;
   try {
      const createproduct = await PrismaConnect.products.createMany({ data: data });
      return res.status(200).json({ message: "OK", data: createproduct });
   } catch (error) {
      return res.status(500).json({ message: "Internal Server Error.", hint: error });
   }
});

// Route Get Products
app.get("/api/product", async (req, res): Promise<Response> => {
   try {
      const products = await PrismaConnect.products.findMany();

      if (!products) {
         return res.status(404).json({ message: "No products found." });
      }

      return res.status(200).json({ message: "OK", data: products });
   } catch (error) {
      return res.status(500).json({ message: "Internal Server Error.", hint: error });
   }
});

app.post("/api/transaction", async (req, res): Promise<Response> => {
   const data: { paymentCode: string; productData: {}[]; totalPriceAll: number } = req.body;

   if (!data || !data.paymentCode || !data.productData || !data.totalPriceAll) {
      return res.status(400).json({ message: "Invalid request body." });
   }

   try {
      const { id: paymentId }: { id: number } = await PrismaConnect.payments.findFirstOrThrow({
         where: { paymentCode: data.paymentCode },
         select: { id: true },
      });

      if (!paymentId) {
         return res.status(400).json({ message: "Invalid payment code." });
      }

      const products: {}[] = data.productData;
      const ProductsTransaction: any[] = [];

      for (const product of products) {
         const p: { productName: string; productQty: number; totalPrice: number } = product as {
            productName: string;
            productQty: number;
            totalPrice: number;
         };

         const { id: productsId }: { id: number } = await PrismaConnect.products.findFirstOrThrow({
            where: { productName: p.productName },
            select: { id: true },
         });

         ProductsTransaction.push({ productsId, productQuantity: p.productQty, totalPrice: p.totalPrice });
      }

      if (ProductsTransaction.length) {
         const createTransactions = await PrismaConnect.transactions.create({
            data: {
               paymentsId: paymentId,
               invoiceNumber: GenerateInvoice() as string,
               paymentString: "",
               status: "PENDING",
               totalPrice: data.totalPriceAll,
               productsTransactions: { createMany: { data: ProductsTransaction } },
            },
            select: {
               invoiceNumber: true,
               paymentString: true,
               totalPrice: true,
               status: true,
               createdAt: true,
               expireAt: true,
               paymentId: { select: { paymentName: true } },
            },
         });

         return res.status(200).json({ message: "Transaction created successfully.", data: createTransactions });
      }

      return res.status(400).json({ message: "No valid products found in the transaction." });
   } catch (error) {
      return res.status(500).json({ message: "Internal Server Error.", hint: error });
   }
});

app.get("/api/transaction", async (req, res): Promise<Response> => {
   const { invoices } = req.query;

   if (!invoices) {
      return res.status(400).json({ message: "Invoices query is required." });
   }

   try {
      const transaction = await PrismaConnect.transactions.findFirstOrThrow({
         where: { invoiceNumber: invoices as string },
         include: {
            paymentId: { select: { paymentName: true } },
            productsTransactions: {
               select: {
                  productQuantity: true,
                  totalPrice: true,
                  productId: {
                     select: { productName: true, productPrice: true, productImage: true, productType: true },
                  },
               },
            },
         },
      });
      return res.status(200).json({ message: "Get Transaction Successfully.", data: transaction });
   } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal Server Error.", hint: error });
   }
});

app.get("/api/payments", async (_req, res): Promise<Response> => {
   return res.status(200).json({
      message: "Get Payments Successfully.",
      data: await PrismaConnect.payments.findMany({
         select: { paymentCode: true, paymentName: true, status: true },
      }),
   });
});

export default app;
