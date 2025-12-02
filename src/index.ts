import bcrypt from "bcryptjs";
import express, { Response } from "express";

import PrismaConnect from "../lib/PrismaConnect.js";
import { AppError, InterfaceAppError } from "../lib/AppError.js";
import { TypeLanguage, InterfaceResponseByLanguage, InterfaceUserDatabase } from "../interface/api_auth.js";
import { InterfaceUserCreate } from "../interface/api_create_user.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (_req, res) => {
   res.send("Hello Express!");
});

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
      const finduser: InterfaceUserDatabase = await PrismaConnect.user.findFirstOrThrow({ where: { username } });
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
      return res.status(500).json({ message: "Internal Server Error." });
   }
});

app.post("/api/users/create", async (req, res): Promise<Response> => {
   if (!req.body) {
      return res.status(500).json({ message: "Invalid request." });
   }
   const { email, name, username, password: req_password } = req.body as InterfaceUserCreate;
   const password: string = await bcrypt.hash(req_password, 10);
   const createuser = await PrismaConnect.user.create({
      data: { email, name, username, password },
      select: { username: true, email: true, createdAt: true },
   });
   return res.status(200).json({ message: "OK", data: createuser });
});

export default app;
