declare namespace forge {
  namespace pki {
    interface CertificateField {
      shortName?: string;
      name?: string;
      value?: string;
      type?: string;
    }
    interface Certificate {
      subject: { attributes: CertificateField[] };
      issuer: { attributes: CertificateField[] };
      serialNumber: string;
      validity: { notBefore: Date; notAfter: Date };
    }
    function certificateToAsn1(cert: Certificate): asn1.Asn1;
    function certificateToPem(cert: Certificate): string;
  }

  namespace asn1 {
    interface Asn1 {
      type: number;
      tagClass?: number;
      value?: Asn1[] | string;
    }
    namespace Type {
      const SEQUENCE: number;
    }
    namespace Class {
      const CONTEXT_SPECIFIC: number;
    }
    function fromDer(bytes: string): Asn1;
    function toDer(obj: Asn1): { getBytes(): string };
  }

  namespace pkcs7 {
    interface PkcsSignedData {
      certificates?: pki.Certificate[];
      verify(certs?: pki.Certificate[]): boolean;
    }
    function messageFromAsn1(asn1: asn1.Asn1): PkcsSignedData;
  }

  namespace util {
    function decode64(s: string): string;
    function encode64(s: string): string;
  }
}

declare module "node-forge" {
  const forge: typeof forge;
  export default forge;
}
