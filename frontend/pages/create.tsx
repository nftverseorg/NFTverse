//@ts-nocheck
import axios from "axios"; // Axios requests
import { eth } from "@state/eth"; // State: ETH
import { option } from "@state/option"; // State: Options
import { toast } from "react-toastify"; // Toast notifications
import Layout from "@components/Layout"; // Layout wrapper
import DatePicker from "react-datepicker"; // Datepicker
import OptionCard from "@components/OptionCard"; // Component: Optioncard
import styles from "@styles/pages/Create.module.scss"; // Component styles
import { ReactElement, useEffect, useState } from "react"; // State management
import { NextRouter, useRouter } from "next/dist/client/router"; // Next router

/**
 * Selection states
 */
enum State {
  selectNFT = 0,
  setTerms = 1,
}

export default function Create() {
  // Page navigation router
  const router: NextRouter = useRouter();

  // Global state
  const { address, unlock }: { address: string | null; unlock: Function } =
    eth.useContainer();
  const { createOption }: { createOption: Function } = option.useContainer();

  // Current page state (Select / Set)
  const [state, setState] = useState<number>(State.selectNFT);
  // Number of retrieved NFTs (used for pagination)
  const [numOSNFTs, setNumOSNFTs] = useState<number>(0);
  // List of ERC721 NFTs
  const [NFTList, setNFTList] = useState<Object[]>([]);
  // Loading status (for retrieval and buttons)
  const [loading, setLoading] = useState<boolean>(false);
  // Currently selected NFT details
  const [selected, setSelected] = useState<Object | null>(null);
  // Parameter: Premium to pay
  const [premium, setPremium] = useState<number>(5);
  // Parameter: Maximum amount to option (bid ceiling)
  const [maxAmount, setMaxAmount] = useState<number>(3);
  // Parameter: Timestamp of option completion
  const [optionCompleted, setOptionCompleted] = useState<number>(
    new Date().setDate(new Date().getDate() + 7)
  );

  /**
   * Renders button based on current state
   * @returns {ReactElement} button
   */
  function renderActionButton() {
    if (!address) {
      // Not authenticated
      return <button onClick={() => unlock()}>Unlock</button>;
    } else if (state === State.selectNFT && selected) {
      // NFT selected
      return (
        <button onClick={() => setState(State.setTerms)}>Craft terms</button>
      );
    } else if (state === State.selectNFT) {
      // No NFT selected
      return <button disabled>Must select NFT</button>;
    } else if (
      state === State.setTerms &&
      (!premium || !maxAmount || !optionCompleted)
    ) {
      // Missing terms
      return <button disabled>Must enter terms</button>;
    } else if (state === State.setTerms && !loading) {
      // Ready to Hedge your NFT
      return <button onClick={createOptionWithLoading}>Hedge your NFT</button>;
    } else if (state === State.setTerms) {
      // Pending option creation
      return <button disabled>Hedging NFT...</button>;
    }
  }

  /**
   * Filters array of all NFTs to only ERC721 schema qualifiers
   * @param {Object[]} assets all NFTs
   * @returns {Object[]} filtered ERC721 assets
   */
  function filter721(assets: Object[]): Object[] {
    return assets.filter(
      // Match for schema_name === "ERC721"
      (asset) => asset.asset_contract.schema_name === "ERC721"
    );
  }

  /**
   * Collects ERC721 NFTs from OpenSea API
   */
  async function collectNFTs(): Promise<void> {
    setLoading(true); // Toggle loading

    // Collect NFTs from OpenSea
    try {
      const response = await axios.get(
        //`https://rinkeby-api.opensea.io/api/v1/assets?owner=${address}&order_direction=desc&offset=${numOSNFTs}&limit=9`
        "https://testnets-api.opensea.io/api/v1/assets?owner="+address+"&order_direction=desc"
      );
      setNumOSNFTs(response.data.assets.length); // Update number of retrieved NFTs
      // Update ERC721 nfts
      setNFTList([...NFTList, ...filter721(response.data.assets)]);
    } catch {
      // Toast error if retrieval fails
      toast.error("Error when collecting wallet NFT's.");
    }

    setLoading(false); // Toggle loading
  }

  /**
   * Creates a option, with toggled loading
   */
  async function createOptionWithLoading(): Promise<void> {
    setLoading(true); // Toggle loading

    try {
      // Hedge your NFT
      const optionId = await createOption(
        selected.asset_contract.address,
        selected.token_id,
        premium,
        maxAmount,
        optionCompleted,
        {
          imageURL: selected.image_preview_url ?? "",
          name: selected.name ?? "Untitled",
          description: selected.description ?? "No Description",
        }
      );
      // Prompt success
      toast.success("Successfully created option! Redirecting...");
      // Reroute to option page
      router.push(`/option/${optionId}`);
    } catch {
      // On error, prompt
      toast.error("Error when attempting to Hedge your NFT.");
    }

    setLoading(false); // Toggle loading
  }

  // -> Lifecycle: on address update
  useEffect(() => {
    // Collect NFTs if authenticated
    if (address) collectNFTs();
  }, [address]);

  return (
    <Layout>
      <div className="sizer">
        <div className={styles.create}>
          {/* Create page title */}
          <h1>Hedge your NFT</h1>
          <p>Select an NFT and choose your terms.</p>

          <div className={styles.create__action}>
            {/* Action card phases */}
            <div className={styles.create__action_phase}>
              {/* Select NFT */}
              <div
                className={
                  state === State.selectNFT
                    ? styles.create__action_active
                    : undefined
                }
              >
                <span>Select NFT</span>
              </div>

              {/* Set Terms */}
              <div
                className={
                  state === State.setTerms
                    ? styles.create__action_active
                    : undefined
                }
              >
                <span>Set Terms</span>
              </div>
            </div>

            {/* Action card content */}
            <div className={styles.create__action_content}>
              {address ? (
                // If user is authenticated
                state === State.selectNFT ? (
                  // If the current state is NFT selection
                  <div className={styles.create__action_select}>
                    {NFTList.length > 0 ? (
                      // If > 0 NFTs exist in user wallet
                      <>
                        <div className={styles.create__action_select_list}>
                          {NFTList.map((nft, i) => {
                            // Render each NFT
                            return (
                              <OptionCard
                                key={i}
                                onClickHandler={() => setSelected(nft)}
                                selected={
                                  selected?.token_id === nft.token_id &&
                                  selected?.asset_contract?.address ===
                                    nft.asset_contract.address
                                }
                                imageURL={nft.image_preview_url}
                                name={nft.name ?? "Untitled"}
                                description={
                                  nft.description ?? "No description"
                                }
                                contractAddress={nft.asset_contract.address}
                                tokenId={nft.token_id}
                              />
                            );
                          })}
                        </div>

                        {numOSNFTs % 9 == 0 && !loading ? (
                          // If user capped limit of OpenSea pull, allow pulling more
                          <div className={styles.create__action_select_more}>
                            <button onClick={collectNFTs}>
                              Load more NFTs
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      // If user does not own NFTs
                      <NoOwnedNFTs />
                    )}
                    {loading ? (
                      // If user NFTs are being loaded
                      <CreateLoadingNFTs />
                    ) : null}
                  </div>
                ) : (
                  // Enable user input of terms
                  <div className={styles.create__action_terms}>
                    {/* Prefilled NFT Contract Address */}
                    <div>
                      <h3>NFT Contract Address</h3>
                      <p>Contract address for ERC721-compliant NFT.</p>
                      <input
                        type="text"
                        value={selected.asset_contract.address}
                        disabled
                      />
                    </div>

                    {/* Prefilled NFT ID */}
                    <div>
                      <h3>NFT ID</h3>
                      <p>Unique identifier for your NFT.</p>
                      <input type="text" value={selected.token_id} disabled />
                    </div>

                    {/* User input: Premium Rate */}
                    <div>
                      <h3>Yield</h3>
                      <p>
                        Maximum yield you are willing to pay for hedging  your downside.
                      </p>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="5"
                        min="0.01"
                        value={premium}
                        onChange={(e) => setPremium(e.target.value)}
                      />
                    </div>

                    {/* User input: max option amount */}
                    <div>
                      <h3>Max Hedge Amount</h3>
                      <p>
                        Maximum hedged Ether you are willing to pay premium
                        for.
                      </p>
                      <input
                        type="number"
                        placeholder="3"
                        step="0.01"
                        min="0"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                      />
                    </div>

                    {/* User input: Option termination date */}
                    <div>
                      <h3>Option Expiry</h3>
                      <p>Date of option termination.</p>
                      <DatePicker
                        selected={optionCompleted}
                        onChange={(date) => setOptionCompleted(date)}
                        showTimeSelect
                        minDate={new Date()}
                      />
                    </div>
                  </div>
                )
              ) : (
                // If user is unauthenticated
                <CreateUnauthenticated />
              )}
            </div>
          </div>

          {/* Render action buttons */}
          <div className={styles.create__button}>{renderActionButton()}</div>
        </div>
      </div>
    </Layout>
  );
}

/**
 * State when user has not authenticated
 * @returns {ReactElement}
 */
function CreateUnauthenticated(): ReactElement {
  return (
    <div className={styles.create__action_content_unauthenticated}>
      <img src="/vectors/unlock.svg" height="30px" alt="Unlock" />
      <h3>Unlock wallet</h3>
      <p>Please connect your wallet to get started.</p>
    </div>
  );
}

/**
 * State when user's NFTs are loading
 * @returns {ReactElement}
 */
function CreateLoadingNFTs(): ReactElement {
  return (
    <div className={styles.create__action_loading}>
      <span>Loading NFTs...</span>
    </div>
  );
}

/**
 * State when user does not own any ERC721 NFTs
 * @returns {ReactElement}
 */
function NoOwnedNFTs(): ReactElement {
  return (
    <div className={styles.create__action_content_unauthenticated}>
      <img src="/vectors/empty.svg" alt="Empty" height="30px" />
      <h3>No NFTs in wallet.</h3>
      <p>Please mint NFTs before trying to Hedge your NFT.</p>
    </div>
  );
}
