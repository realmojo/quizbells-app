import * as SecureStore from "expo-secure-store";

const INFO_KEY = "quizbells-auth";

export const BASE_URL = "https://quizbells.com";

export const setQuizbellsAuth = async (quizbellsAuth: any) => {
  await SecureStore.setItemAsync(INFO_KEY, JSON.stringify(quizbellsAuth));
};

export const getQuizbellsAuth = async () => {
  const quizbellsAuthRaw = (await SecureStore.getItemAsync(INFO_KEY)) || "{}";
  const quizbellsAuth = JSON.parse(quizbellsAuthRaw);
  return quizbellsAuth || {};
};

export const getQuizbellsAuthUserId = async () => {
  const quizbellsAuth = await getQuizbellsAuth();
  return quizbellsAuth.userId || "";
};
