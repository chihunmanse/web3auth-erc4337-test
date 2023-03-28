/** @format */

import { Logger } from "@ethersproject/logger";

const logger = new Logger("bytes/5.7.0");

const HexCharacters: string = "0123456789abcdef";

type Bytes = ArrayLike<number>;

type BytesLike = Bytes | string;

type DataOptions = {
  allowMissingPrefix?: boolean;
  hexPad?: "left" | "right" | null;
};

interface Hexable {
  toHexString(): string;
}

function isHexable(value: any): value is Hexable {
  return !!value.toHexString;
}

function isHexString(value: any, length?: number): boolean {
  if (typeof value !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }
  if (length && value.length !== 2 + 2 * length) {
    return false;
  }
  return true;
}

function isInteger(value: number) {
  return typeof value === "number" && value == value && value % 1 === 0;
}

function isBytes(value: any): value is Bytes {
  if (value == null) {
    return false;
  }

  if (value.constructor === Uint8Array) {
    return true;
  }
  if (typeof value === "string") {
    return false;
  }
  if (!isInteger(value.length) || value.length < 0) {
    return false;
  }

  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (!isInteger(v) || v < 0 || v >= 256) {
      return false;
    }
  }
  return true;
}

function hexlify(
  value: BytesLike | Hexable | number | bigint,
  options?: DataOptions
): string {
  if (!options) {
    options = {};
  }

  if (typeof value === "number") {
    logger.checkSafeUint53(value, "invalid hexlify value");

    let hex = "";
    while (value) {
      hex = HexCharacters[value & 0xf] + hex;
      value = Math.floor(value / 16);
    }

    if (hex.length) {
      if (hex.length % 2) {
        hex = "0" + hex;
      }
      return "0x" + hex;
    }

    return "0x00";
  }

  if (typeof value === "bigint") {
    value = value.toString(16);
    if (value.length % 2) {
      return "0x0" + value;
    }
    return "0x" + value;
  }

  if (
    options.allowMissingPrefix &&
    typeof value === "string" &&
    value.substring(0, 2) !== "0x"
  ) {
    value = "0x" + value;
  }

  if (isHexable(value)) {
    return value.toHexString();
  }

  if (isHexString(value)) {
    if ((<string>value).length % 2) {
      if (options.hexPad === "left") {
        value = "0x0" + (<string>value).substring(2);
      } else if (options.hexPad === "right") {
        value += "0";
      } else {
        logger.throwArgumentError("hex data is odd-length", "value", value);
      }
    }
    return (<string>value).toLowerCase();
  }

  if (isBytes(value)) {
    let result = "0x";
    for (let i = 0; i < value.length; i++) {
      let v = value[i];
      result += HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f];
    }
    return result;
  }

  return logger.throwArgumentError("invalid hexlify value", "value", value);
}

export function hexConcat(items: ReadonlyArray<BytesLike>): string {
  let result = "0x";
  items.forEach((item) => {
    result += hexlify(item).substring(2);
  });
  return result;
}
