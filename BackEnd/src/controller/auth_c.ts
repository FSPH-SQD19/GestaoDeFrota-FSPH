import { Request, Response } from "express";
import { login } from "../service/auth_s";

export async function loginController(req: Request, res: Response){
    try{
        const { email, senha } = req.body ?? {};
        if(
            typeof email !== "string" ||
            typeof senha !== "string" ||
            !email.trim() ||
            !senha
        )
        return res.status(400).json({error: "email e senha são obrigatórios"});
        const resultado = await login({email: email.trim(), senha});
        return res.status(200).json(resultado);
    }catch(error){
        if(error instanceof Error && error.message === "Credenciais inválidas"){
            return res.status(401).json({error: error.message});
        }
        console.error(error);

        return res.status(500).json({
            mensagem: "Erro interno ao realizar login.",
        });
    }
}
