declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: any;
    $disconnect(): Promise<void>;
    $transaction<T>(arg: Promise<unknown>[] | ((tx: any) => Promise<T>)): Promise<T>;
  }

  export namespace Prisma {
    class PrismaClientKnownRequestError extends Error {}
    class PrismaClientUnknownRequestError extends Error {}
    class PrismaClientInitializationError extends Error {}
    class PrismaClientRustPanicError extends Error {}
    class PrismaClientValidationError extends Error {}
  }
}
