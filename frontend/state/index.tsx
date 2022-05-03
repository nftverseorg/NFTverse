//@ts-nocheck
import { eth } from "@state/eth"; // Eth state provider
import { option } from "@state/option"; // Option functions state provider
import type { ReactElement } from "react"; // Types

/**
 * State providing wrapper
 * @param {ReactElement[]} children to inject
 * @returns {ReactElement} wrapper
 */
export default function StateProvider({
  children,
}: {
  children: ReactElement[];
}): ReactElement {
  return (
    // Wrap in eth and option sub-providers
    <eth.Provider>
      <option.Provider>{children}</option.Provider>
    </eth.Provider>
  );
}
