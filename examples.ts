import { composeM, IO, Maybe } from "./mod.ts";

const IOCombiner = composeM((t) => IO.of(() => t));
const IOSome = <T>(val: T) => IOCombiner(Maybe.some(val));
const IONone = <T>() => IOCombiner(Maybe.none());