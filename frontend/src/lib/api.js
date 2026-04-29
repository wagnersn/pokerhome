import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
    baseURL: `${BACKEND}/api`,
    withCredentials: true,
});

export default api;
export { BACKEND };
