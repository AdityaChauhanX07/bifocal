import rawDataset from "virtual:bifocal-eval-dataset";
import { parseHeldOut } from "./runner";

export const heldOut = parseHeldOut(rawDataset);
