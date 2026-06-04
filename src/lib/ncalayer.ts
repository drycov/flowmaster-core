// NCALayer (Kazakhstan EDS) WebSocket client.
// NCALayer is a desktop agent the signer runs locally on port 13579.
// This client only talks to the agent over WSS; the agent surfaces the user's
// certificate stores and produces PKCS#7/XMLDSig signatures.
// If NCALayer is not running you will get a connection error — that is expected
// and surfaced to the user as "NCALayer not detected".

export interface NcaSignResult {
  signature: string;
  certSubject?: string;
  certSerial?: string;
  certIssuer?: string;
}

const NCA_URL = "wss://127.0.0.1:13579/";

export async function signCMS(dataB64: string): Promise<NcaSignResult> {
  return new Promise((resolve, reject) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(NCA_URL);
    } catch (e) {
      reject(e);
      return;
    }
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("NCALayer timeout"));
    }, 60_000);

    socket.onopen = () => {
      const req = {
        module: "kz.gov.pki.knca.commonUtils",
        method: "createCAdESFromBase64",
        args: ["PKCS12", "SIGNATURE", dataB64, true],
      };
      socket.send(JSON.stringify(req));
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("NCALayer not detected"));
    };
    socket.onmessage = (ev) => {
      clearTimeout(timeout);
      try {
        const r = JSON.parse(ev.data);
        if (r?.result?.result) {
          resolve({ signature: r.result.result });
        } else {
          reject(new Error(r?.errorCode || r?.message || "NCALayer error"));
        }
      } catch (err) {
        reject(err);
      } finally {
        socket.close();
      }
    };
  });
}
