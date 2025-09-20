// Use the SuiClient from dapp-kit to ensure compatibility
type SuiClient = any; // We'll use any to avoid version conflicts

/**
 * Check if a user has a profile on-chain
 * @param suiClient - Sui client instance
 * @param userAddress - User's wallet address
 * @returns Promise<boolean> - True if user has a profile, false otherwise
 */
export async function hasUserProfile(suiClient: SuiClient, userAddress: string): Promise<boolean> {
    try {
        // Query for UserProfile objects owned by the user
        const result = await suiClient.getOwnedObjects({
            owner: userAddress,
            filter: {
                StructType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::user::UserProfile`
            },
            options: {
                showContent: true,
                showType: true
            }
        });

        // Return true if user has at least one profile
        return result.data.length > 0;
    } catch (error) {
        console.error('Error checking user profile:', error);
        return false;
    }
}

/**
 * Get user profile object
 * @param suiClient - Sui client instance
 * @param userAddress - User's wallet address
 * @returns Promise<UserProfile | null> - User profile object or null if not found
 */
export async function getUserProfile(suiClient: SuiClient, userAddress: string): Promise<any | null> {
    try {
        const result = await suiClient.getOwnedObjects({
            owner: userAddress,
            filter: {
                StructType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::user::UserProfile`
            },
            options: {
                showContent: true,
                showType: true,
                showOwner: true
            }
        });

        if (result.data.length > 0) {
            return result.data[0];
        }

        return null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

/**
 * Parse user profile data from Sui object
 * @param profileObject - Sui object containing UserProfile
 * @returns Parsed profile data
 */
export function parseUserProfile(profileObject: any) {
    try {
        if (!profileObject.data?.content?.fields) {
            return null;
        }

        const fields = profileObject.data.content.fields;

        return {
            id: fields.id?.id,
            displayName: fields.display_name,
            bio: fields.bio,
            letterBank: fields.letter_bank,
            visitCountTotal: fields.visit_count_total,
            boastCheckpoint: fields.boast_checkpoint,
            createdEpoch: fields.created_epoch
        };
    } catch (error) {
        console.error('Error parsing user profile:', error);
        return null;
    }
}