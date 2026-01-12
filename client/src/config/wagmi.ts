import { createConfig, http } from 'wagmi';
import { mainnet, sepolia, arbitrum, polygon } from 'wagmi/chains';

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, arbitrum, polygon],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
  },
});
