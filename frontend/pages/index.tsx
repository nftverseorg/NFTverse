//@ts-nocheck
import axios from "axios"; // Axios
import Link from "next/link"; // Routing
import Layout from "@components/Layout"; // Layout wrapper
import OptionCard from "@components/OptionCard"; // OptionCard component
import styles from "@styles/pages/Home.module.scss"; // Component styles
import { useRouter } from "next/dist/client/router"; // Router
import type { OptionWithMetadata } from "@utils/types"; // Types
import { ReactElement, useState, useEffect } from "react"; // React

/**
 * Home page
 * @returns {ReactElement}
 */
export default function Home(): ReactElement {
  // Navigation
  const router = useRouter();
  // Option loading status
  const [loading, setLoading] = useState<boolean>(true);
  // Individual options retrieved from chain
  const [options, setOptions] = useState<OptionWithMetadata[]>([]);

  /**
   * Collect options from chain
   */
  async function collectOptions(): Promise<void> {
    setLoading(true); // Toggle loading

    // Update data
    const { data } = await axios.get("/api/options");
    setOptions(data);

    setLoading(false); // Toggle loading
  }

  // --> Lifecycle: collect options on mount
  useEffect(() => {
    collectOptions();
  }, []);

  return (
    <Layout>
      <div>
        {/* Call to action header */}
        <div className={styles.home__cta}>
          <h1>The smartest way to own Digital Assets or NFTs</h1>
          <p>
            Hedge your NFTs via Options.<br/>
            Earn Yield on your Crypto.
          </p>

          {/* CTA action buttons */}
          <div>
            {/* Direct to create page */}
            <Link href="/create">
              <a>Hedge Your NFT</a>
            </Link>

            {/* Open GitHub in new tab */}

          </div>
        </div>

        {/* Feature section of open options */}
        <div className={styles.home__feature}>
          <div className="sizer">
            {/* Title */}
            <h2>Yields Available</h2>
            <p>Retrieved {options.length} options.</p>

            {loading ? (
              // If loading, show loading state
              <div className={styles.home__feature_text}>
                <h3>Loading options...</h3>
                <p>Please wait as we collect the options from chain.</p>
              </div>
            ) : options.length == 0 ? (
              // If no options, show no options found
              <div className={styles.home__feature_text}>
                <h3>No Options Found</h3>
                <p>Be the first to create a options!</p>
              </div>
            ) : (
              // If options are found, render clickable, active loaans
              <div className={styles.home__feature_options}>
                {options.map((option, i) => {
                  return (
                    <OptionCard
                      key={i}
                      name={option.name}
                      description={option.description}
                      contractAddress={option.tokenAddress}
                      imageURL={option.imageURL}
                      tokenId={option.tokenId.toString()}
                      onClickHandler={() => router.push(`/option/${option.optionId}`)}
                      optionDetails={{
                        premium: option.premiumRate,
                        amount: option.optionAmount,
                        max: option.maxOptionAmount,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
