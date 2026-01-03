import bcrypt from "bcryptjs";
import express, { Response } from "express";
import PrismaConnect from "../lib/PrismaConnect.js";
import { AppError, InterfaceAppError } from "../lib/AppError.js";
import {
  TypeLanguage,
  InterfaceResponseByLanguage,
  InterfaceUserDatabase,
} from "../interface/api_auth.js";
import { InterfaceUserCreate } from "../interface/api_create_user.js";
import GenerateInvoice from "../lib/GenerateInvoice.js";
import MidtransAppRun, {
  MidtransValidateSignature,
} from "../lib/MidtransConnect.js";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

app.get("/chef", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/chef.html"));
});
app.get("/", (_req, res) => {
  return res.send("Hello Express!");
});

// Route AUTH
app.post("/api/auth", async (req, res): Promise<Response> => {
  if (!req.body || !req.query) {
    return res.status(500).json({ message: "Invalid request." });
  }
  const q: { lang: string } = req.query as { lang: string };

  const { username, password: req_password } = req.body;

  const responseByLanguage: Record<TypeLanguage, InterfaceResponseByLanguage> =
    {
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
    const finduser: InterfaceUserDatabase =
      await PrismaConnect.users.findFirstOrThrow({ where: { username } });
    const compare: boolean = await bcrypt.compare(
      req_password,
      finduser.password
    );
    if (!compare) {
      throw new AppError(
        responseByLanguage[q.lang as TypeLanguage].wrong_password,
        "INVALID_PASSWORD"
      ) as InterfaceAppError;
    }
    const { password, ...user }: InterfaceUserDatabase =
      finduser as InterfaceUserDatabase;

    return res.status(200).json({
      message: responseByLanguage[q.lang as TypeLanguage].success_login,
      data: user,
    });
  } catch (error) {
    if (error.code == "P2025") {
      return res.status(404).json({
        message: responseByLanguage[q.lang as TypeLanguage].user_nothing,
      });
    }
    if (error.code == "INVALID_PASSWORD") {
      return res.status(401).json({ message: error.message });
    }
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
  }
});

// Route Create User
app.post("/api/users/create", async (req, res): Promise<Response> => {
  if (!req.body) {
    return res.status(500).json({ message: "Invalid request." });
  }
  try {
    const {
      email,
      name,
      username,
      password: req_password,
    } = req.body as InterfaceUserCreate;
    const password: string = await bcrypt.hash(req_password, 10);
    const createuser = await PrismaConnect.users.create({
      data: { email, name, username, password },
      select: { username: true, email: true, createdAt: true },
    });
    return res.status(200).json({ message: "OK", data: createuser });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
  }
});

// Route Create Product
app.post("/api/product/create", async (req, res): Promise<Response> => {
  if (!req.body) {
    return res.status(500).json({ message: "Invalid request." });
  }
  const data = req.body;
  try {
    const createproduct = await PrismaConnect.products.createMany({
      data: data,
    });
    return res.status(200).json({ message: "OK", data: createproduct });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
  }
});

app.patch("/api/product/update", async (req, res): Promise<Response> => {
  const { invoiceNumber, productsId, status } = req.body;

  try {
    const updateproduct = await PrismaConnect.transactions.update({
      where: { invoiceNumber },
      data: {
        productsTransactions: {
          updateMany: {
            where: { productsId },
            data: { transactionStatus: status },
          },
        },
      },
      include: { productsTransactions: true },
    });
    return res.status(200).json({ message: "OK", data: updateproduct });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
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
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
  }
});

app.get("/api/transactions/status", async (req, res): Promise<Response> => {
  const { invoiceNumber } = req.query;
  console.log(
    "Received request for transaction status with invoiceNumber:",
    invoiceNumber
  );
  if (!invoiceNumber) {
    return res.status(400).json({ message: "Invoice number is required." });
  }
  try {
    console.log(
      "Checking transaction status for invoiceNumber:",
      invoiceNumber
    );
    const transactions = await PrismaConnect.transactions.findFirst({
      where: { invoiceNumber: invoiceNumber as string },
      select: {
        invoiceNumber: true,
        status: true,
      },
    });
    if (!transactions) {
      console.log("Transaction not found for invoiceNumber:", invoiceNumber);
      return res.status(404).json({ message: "Transaction not found." });
    }
    console.log("Transaction status checked for invoiceNumber:", invoiceNumber);
    return res.status(200).json({ message: "OK", data: transactions });
  } catch (error) {
    console.log(
      "Error checking transaction status for invoiceNumber:",
      invoiceNumber,
      error
    );
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
  }
});

app.post("/api/webhook", async (req, res): Promise<Response> => {
  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
  } = req.body;
  console.log("Received webhook for order_id:", order_id);
  try {
    const validate = await MidtransValidateSignature({
      grossAmount: gross_amount,
      orderId: order_id,
      statusCode: status_code,
      trueSignature: signature_key,
    });
    if (!validate) {
      console.log("Invalid signature. Aborting transaction update.");
      return res.status(400).json({ message: "Invalid signature." });
    }
    console.log("Valid signature. Processing transaction update...");
    const update = await PrismaConnect.transactions.update({
      where: { invoiceNumber: order_id },
      data: { status: transaction_status.toUpperCase() },
    });
    if (!update) {
      console.log("Transaction not found for update.");
      return res.status(404).json({ message: "Transaction not found." });
    }
    console.log("Transaction updated:", update);
    return res
      .status(200)
      .json({ message: "Transaction updated.", data: update });
  } catch (error) {
    console.log("Error processing webhook:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
  }
});

app.post("/api/transaction", async (req, res): Promise<Response> => {
  const data: {
    paymentName: string;
    productData: {}[];
    totalPriceAll: number;
    userId: number;
  } = req.body;

  if (
    !data ||
    !data.userId ||
    !data.paymentName ||
    !data.productData ||
    !data.totalPriceAll
  ) {
    return res.status(400).json({ message: "Invalid request body." });
  }

  try {
    const { id: paymentId }: { id: number } =
      await PrismaConnect.payments.findFirstOrThrow({
        where: { paymentName: data.paymentName },
        select: { id: true },
      });

    if (!paymentId) {
      return res.status(400).json({ message: "Invalid payment code." });
    }

    const products: {}[] = data.productData;
    const ProductsTransaction: any[] = [];

    for (const product of products) {
      const p: { productName: string; productQty: number; totalPrice: number } =
        product as {
          productName: string;
          productQty: number;
          totalPrice: number;
        };

      const { id: productsId }: { id: number } =
        await PrismaConnect.products.findFirstOrThrow({
          where: { productName: p.productName },
          select: { id: true },
        });

      ProductsTransaction.push({
        productsId,
        productQuantity: p.productQty,
        totalPrice: p.totalPrice,
      });
    }

    const invoice: string = GenerateInvoice() as string;

    const createPayment = await MidtransAppRun({
      payment_type: "qris",
      qris: {
        acquirer: "gopay",
      },
      transaction_details: {
        order_id: invoice,
        gross_amount: data.totalPriceAll,
      },
    });

    const paymentString: string = createPayment?.actions[0].url as string;

    if (ProductsTransaction.length) {
      const createTransactions = await PrismaConnect.transactions.create({
        data: {
          paymentsId: paymentId,
          invoiceNumber: invoice,
          paymentString: paymentString,
          status: "PENDING",
          usersId: data.userId,
          totalPrice: data.totalPriceAll,
          expireAt: new Date(createPayment.expiry_time),
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

      return res.status(200).json({
        message: "Transaction created successfully.",
        data: createTransactions,
      });
    }

    return res
      .status(400)
      .json({ message: "No valid products found in the transaction." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
  }
});

app.get("/api/transaction", async (req, res): Promise<Response> => {
  const { invoices, get, userId } = req.query;

  if (!invoices) {
    return res.status(400).json({ message: "Invoices query is required." });
  }

  if (invoices && (get as string) == "all") {
    try {
      let transactions;
      if (userId) {
        transactions = await PrismaConnect.transactions.findMany({
          where: { usersId: Number(userId) },
          include: {
            paymentId: true,
            productsTransactions: {
              include: { productId: true },
            },
          },
        });
      } else {
        transactions = await PrismaConnect.transactions.findMany({
          include: {
            paymentId: true,
            productsTransactions: {
              include: { productId: true },
            },
          },
        });
      }
      return res.status(200).json({
        message: "Get All Transactions Successfully.",
        data: transactions,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Internal Server Error.", hint: error });
    }
  }

  try {
    const transaction = await PrismaConnect.transactions.findFirst({
      where: { invoiceNumber: invoices as string },
      include: {
        paymentId: { select: { paymentName: true } },
        productsTransactions: {
          select: {
            productQuantity: true,
            totalPrice: true,
            productId: {
              select: {
                productName: true,
                productPrice: true,
                productImage: true,
                productType: true,
              },
            },
          },
        },
      },
    });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    return res
      .status(200)
      .json({ message: "Get Transaction Successfully.", data: transaction });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error.", hint: error });
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
