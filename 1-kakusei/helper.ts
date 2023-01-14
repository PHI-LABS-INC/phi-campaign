export const retry = async <T>(f: () => Promise<T>, retries: number): Promise<T> => {
  try {
    return await f();
  } catch (err) {
    return retries > 0 ? retry(f, retries - 1) : Promise.reject(err);
  }
};

export const getENSFromLandURL = (url: string) => {
  try {
    const u = new URL(url);
    if (u.origin !== "https://land.philand.xyz") throw new Error("invalid origin");
    if (!u.pathname.endsWith(".eth")) throw new Error("invalid pathname");
    return decodeURI(u.pathname.slice(1));
  } catch {
    return null;
  }
};
