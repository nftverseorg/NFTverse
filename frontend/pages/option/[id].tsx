//@ts-nocheck
import dayjs from "dayjs"; // Dates
import axios from "axios"; // Requests
import { eth } from "@state/eth"; // State container
import Layout from "@components/Layout"; // Layout
import { collectSingleOption } from "@api/option"; // Collection
import { ReactElement, useState } from "react"; // React
import { option as optionProvider } from "@state/option"; // State container
import styles from "@styles/pages/Option.module.scss"; // Component styles
import type { OptionWithMetadata } from "@utils/types"; // Types

// Zero Address constant
const ZERO_ADDRESS: string = "0x0000000000000000000000000000000000000000";

/**
 * Option page
 * @param {OptionWithMetadata} option to pre-populate page (SSR)
 * @returns {ReactElement}
 */
export default function Option({
  option: defaultOption,
}: {
  option: OptionWithMetadata;
}) {
  // Collect individual action functions
  const { cancelOption, drawOption, seizeOption, underwriteOption, repayOption } =
    optionProvider.useContainer();
  // Collect authentication
  const { address, unlock }: { address: string | null; unlock: Function } =
    eth.useContainer();

  // Current page details
  const [option, setOption] = useState<OptionWithMetadata>(defaultOption);
  // Enterred bid amount
  const [bid, setBid] = useState<number>(0);
  // Button loading status
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Refresh option data by hitting back-end
   */
  async function refreshOption(): Promise<void> {
    const { data } = await axios.get(`/api/option?id=${option.optionId}`);
    setOption(data);
  }

  /**
   * Runs a provided function w/ loading and data refresh
   * @param {Function} call to encapsulate
   */
  async function runWithLoading(call: Function): Promise<void> {
    setLoading(true); // Toggle loading
    await call(); // Call function
    await refreshOption(); // Refresh page data
    setLoading(false); // Toggle loading
  }

  return (
    <Layout>
      <div>
        {/* Option NFT showcase */}
        <div className={styles.option__image}>
          <img src={option.imageURL.slice(0, -5)} alt={option.name} />
        </div>

        <div className="sizer">
          {/* Option NFT content */}

          <div className={styles.option__content}>
            {/* Left: details */}
            <OptionDetails {...option} />

            {/* Right: actions */}
            <div>
              <h2>Actions</h2>

              {address ? (
                // Ensure user is authenticated
                <>
                  {/* Underwrite option */}
                  <div>
                    <h4>Sell Put Option</h4>
                    <p>
                      An option seller can secure this NFT (and become Top Put Options Seller) so long as the option has available capacity (is under the strike price asked).
                      <br/>
                      <b><i> Premium (Strike Price x Yield) : {bid*option.premiumRate/100} Ether</i></b>
                    </p>
                    {option.tokenOwner !== ZERO_ADDRESS &&
                    option.optionCompleteTime >
                      Math.round(new Date().getTime() / 1000) &&
                    option.optionAmount !== option.maxOptionAmount ? (
                      <div>
                        <input
                          type="number"
                          value={bid}
                          onChange={(e) => setBid(e.target.value)}
                          placeholder="Bid Value (Ether)"
                          min={option.optionAmount}
                          max={option.maxOptionAmount}
                          step="0.000001"
                        />
                        <button
                          onClick={() =>
                            runWithLoading(() =>
                              underwriteOption(option.optionId, bid)
                            )
                          }
                          disabled={
                            loading ||
                            bid === 0 ||
                            bid <= option.optionAmount ||
                            bid > option.maxOptionAmount
                          }
                        >
                          {loading
                            ? "Loading..."
                            : bid == 0
                            ? "Bid cannot be 0"
                            : bid < option.optionAmount
                            ? "Bid under top bid"
                            : bid > option.maxOptionAmount
                            ? "Bid too large"
                            : "Sell Put Option"}
                        </button>
                      </div>
                    ) : (
                      <span>Option cannot be underwritten.</span>
                    )}
                  </div>

                  {/* Draw option */}
                  <div>
                    <h4>Draw Capital</h4>
                    <p>
                      The option buyer can draw capital as it becomes available
                      with new bids, until expiry.
                    </p>
                    <button
                      onClick={() =>
                        runWithLoading(() => drawOption(option.optionId))
                      }
                      disabled={
                        loading ||
                        option.optionAmountDrawn === option.optionAmount ||
                        address !== option.tokenOwner
                      }
                    >
                      {loading
                        ? "Loading..."
                        : option.optionAmountDrawn === option.optionAmount
                        ? "No capacity to draw"
                        : address !== option.tokenOwner
                        ? "Not owner"
                        : "Draw Capital"}
                    </button>
                  </div>

                  {/* Repay Capital */}
                  <div>
                    <h4>Repay Capital</h4>
                    <p>
                      Anyone can repay capital, as long as it is unpaid, not
                      expired, and has at least 1 bid.
                    </p>
                    <button
                      onClick={() =>
                        runWithLoading(() => repayOption(option.optionId))
                      }
                      disabled={
                        loading ||
                        option.tokenOwner === ZERO_ADDRESS ||
                        option.firstBidTime === 0 ||
                        option.optionCompleteTime <=
                          Math.round(new Date().getTime() / 1000)
                      }
                    >
                      {loading
                        ? "Loading..."
                        : option.tokenOwner === ZERO_ADDRESS
                        ? "Option is already repaid"
                        : option.firstBidTime === 0
                        ? "Option has no bids to repay"
                        : option.optionCompleteTime <=
                          Math.round(new Date().getTime() / 1000)
                        ? "Option has expired"
                        : "Repay Capital"}
                    </button>
                  </div>

                  {/* Cancel option */}
                  <div>
                    <h4>Cancel option</h4>
                    <p>
                      The option buyer can cancel the option and recollect their NFT
                      until the first bid has been placed.
                    </p>
                    <button
                      onClick={() =>
                        runWithLoading(() => cancelOption(option.optionId))
                      }
                      disabled={
                        loading ||
                        option.optionAmount > 0 ||
                        address !== option.tokenOwner
                      }
                    >
                      {loading
                        ? "Loading..."
                        : option.optionAmount > 0
                        ? "Cannot cancel with bids"
                        : address !== option.tokenOwner
                        ? "Not owner"
                        : "Cancel Option"}
                    </button>
                  </div>

                  {/* Seize option */}
                  <div>
                    <h4>Seize option</h4>
                    <p>
                      Anyone can call seize option on behalf of the option seller if the
                      option buyer defaults on their terms.
                    </p>
                    <button
                      onClick={() =>
                        runWithLoading(() => seizeOption(option.optionId))
                      }
                      disabled={
                        loading ||
                        option.tokenOwner === ZERO_ADDRESS ||
                        option.optionCompleteTime >
                          Math.round(new Date().getTime() / 1000)
                      }
                    >
                      {loading
                        ? "Loading..."
                        : option.tokenOwner === ZERO_ADDRESS
                        ? "Option is already repaid"
                        : option.optionCompleteTime >
                          Math.round(new Date().getTime() / 1000)
                        ? "Option has not expired"
                        : "Seize option"}
                    </button>
                  </div>
                </>
              ) : (
                // If unauthenticated, return authentication prompt
                <div>
                  <h4>Unauthenticated</h4>
                  <p>Please authenticate to take any actions.</p>
                  <button onClick={unlock}>Unlock</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}


/**
 * Left side: general option and NFT details
 * @param {OptionWithMetadata} option details
 * @returns {ReactElement}
 */
function OptionDetails(option: OptionWithMetadata): ReactElement {
  return (
    <div>
      {/* NFT details */}
      <h1>{option.name}</h1>
      <p>{option.description}</p>

      {/* Option details */}
      <h2>Put Option Details</h2>
      {option.tokenOwner === ZERO_ADDRESS ? (
        // If token owner = 0x0 force repaid status
        <span>This option has expired.</span>
      ) : (
        // Else, show data
        <>
          <p>
            <b>Put Option Buyer : </b> {" "}
            <a
              href={`https://rinkeby.etherscan.io/address/${option.tokenOwner}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {option.tokenOwner}
            </a>
            <br/>
            <b>Yield (for Option duration) : </b> {option.premiumRate}% <br/>
            <b>Expiry : </b> {" "}{dayjs(option.optionCompleteTime * 1000).format("MMMM D, YYYY h:mm A")}<br/>
            <b>Strike Price (Ask) : </b> {option.maxOptionAmount} Ether
          </p>
          {option.optionSeller !== ZERO_ADDRESS ? (
            <p>
              <b>Top Put Options Seller : </b>{" "}
              <a
                href={`https://rinkeby.etherscan.io/address/${option.optionSeller}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {option.optionSeller}
              </a><br/>
              <b>Strike Price (Top Bid) : </b> {option.optionAmount} Ether
              <br/>
              <b> Premium (Strike Price x Yield) : </b> {option.premiumRate*option.optionAmount/100} Ether
            </p>
          ) : (
            <p>There are currently no active bids.</p>
          )}
          <p>
            <b> NFT Contract : </b>
            <a
              href={`https://rinkeby.etherscan.io/address/${option.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
            {option.tokenAddress}
            </a>
            <br/>
            <b> NFT Token ID : </b> {option.tokenId} {" "}
          </p>
          <p>
            <a
                href={`https://testnets.opensea.io/assets/${option.tokenAddress}/${option.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
            >
                <img src={"https://storage.googleapis.com/opensea-static/Logomark/OpenSea-Full-Logo%20(dark).png"} alt="" height="25" />
            </a>
            <br/>
            <a
                href={`https://rinkeby.etherscan.io/address/${option.tokenAddress}/${option.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
            >
                <img src={"https://etherscan.io/assets/svg/logos/logo-etherscan.svg"} alt="" height="25" />
            </a>
          </p>
        </>
      )}
    </div>
  );
}

// Run on page load
export async function getServerSideProps({
  params: { id },
}: {
  params: { id: string };
}) {
  // Collect option
  const option = await collectSingleOption(Number(id));

  // Else, return retrieved option
  return {
    // As prop
    props: {
      option,
    },
  };
}