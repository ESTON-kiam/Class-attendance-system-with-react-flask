import axios from "axios";

// Point directly at Flask — works whether proxy is set or not
const api = axios.create({
  baseURL: "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

export default api;
