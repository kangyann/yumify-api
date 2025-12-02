import express from "express";
import PrismaConnect from "../lib/PrismaConnect.js";
import bcrypt from "bcryptjs";

class AppError extends Error {
   code?: string;

   constructor(message: string, code?: string) {
      super(message);
      this.code = code;
   }
}
interface RequestUserCreate {
   email: string;
   name: string;
   username: string;
   password: string;
}
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
   res.send("Hello Express!");
});

app.post("/api/auth", async (req, res) => {
   if (!req.body) {
      return res.status(500).json({ message: "Invalid request." });
   }
   const { username, password: req_password } = req.body;

   try {
      const finduser = await PrismaConnect.user.findFirstOrThrow({ where: { username } });
      const compare = await bcrypt.compare(req_password, finduser.password);
      if (!compare) {
         throw new AppError("Wrong Password", "INVALID_PASSWORD");
      }
      const { password, id, ...user } = finduser;
      return res.status(200).json({ message: "Authentication Success", data: user });
   } catch (error) {
      console.log(error);
      if (error.code == "P2025") {
         return res.status(404).json({ message: "User not found." });
      }
      if (error.code == "INVALID_PASSWORD") {
         return res.status(401).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal Server Error." });
   }
});

app.post("/api/users/create", async (req, res) => {
   if (!req.body) {
      return res.status(500).json({ message: "Invalid request." });
   }
   const { email, name, username, password: req_password } = req.body as RequestUserCreate;
   const password: string = await bcrypt.hash(req_password, 10);
   const createuser = await PrismaConnect.user.create({
      data: { email, name, username, password },
      select: { username: true, email: true, createdAt: true },
   });
   return res.status(200).json({ message: "OK", data: createuser });
});

export default app;
