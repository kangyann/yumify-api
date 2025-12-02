export type TypeLanguage = "id" | "en";

export interface InterfaceResponseByLanguage {
   success_login: string;
   user_nothing: string;
   wrong_password: string;
}
export interface InterfaceUserDatabase {
   id: number;
   name: string;
   email: string;
   username: string;
   password?: string;
   createdAt: Date;
}
