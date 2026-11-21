import { useMemo } from "react";
import axios from "axios";
import { useAuth } from "@clerk/react";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => {
    const inst = axios.create({ baseURL: API });
    inst.interceptors.request.use(async (cfg) => {
      const t = await getToken();
      if (t) cfg.headers.Authorization = `Bearer ${t}`;
      return cfg;
    });
    inst.token = getToken;
    return inst;
  }, [getToken]);
}

export const errMsg = (e) => e?.response?.data?.detail || e?.message || "Erro inesperado";

export const ENGINES = {
  pro: { label: "Adam Pro", sub: "Motor cognitivo completo: arquivos, visão e imagens" },
  neural: { label: "Adam Neural", sub: "Mini Transformer próprio, treinado do zero em PyTorch" },
  local: { label: "Servidor Local", sub: "Seu modelo aberto via Ollama (Llama, Qwen, Gemma)" },
};
