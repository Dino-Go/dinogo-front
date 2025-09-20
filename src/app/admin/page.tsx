'use client';

import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/Toaster';
import { useWalrusClient } from '@/web3/walrusClient';
import { useCheckpoints } from '@/hooks/useCheckpoints';

interface CheckpointFormData {
    latitude: string;
    longitude: string;
    label: string;
    description: string;
    image_url: string;
}

export default function AdminPage() {
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const router = useRouter();
    const { addNotification } = useToast();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const { uploadJSON } = useWalrusClient(suiClient, 'testnet');
    const { checkpoints, loading: checkpointsLoading, error: checkpointsError, refetch: refetchCheckpoints } = useCheckpoints();

    const [formData, setFormData] = useState<CheckpointFormData>({
        latitude: '',
        longitude: '',
        label: '',
        description: '',
        image_url: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [hasAdminCap, setHasAdminCap] = useState<boolean | null>(null);
    const [adminCapId, setAdminCapId] = useState<string | null>(null);

    // Check if user has admin capabilities
    useEffect(() => {
        const checkAdminCap = async () => {
            if (!currentAccount) {
                setHasAdminCap(false);
                return;
            }

            try {
                const adminCapObjects = await suiClient.getOwnedObjects({
                    owner: currentAccount.address,
                    filter: {
                        StructType: `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::checkpoint::AdminCap`
                    }
                });

                if (adminCapObjects.data.length > 0) {
                    setHasAdminCap(true);
                    setAdminCapId(adminCapObjects.data[0].data?.objectId || null);
                } else {
                    setHasAdminCap(false);
                }
            } catch (error) {
                console.error('Error checking admin cap:', error);
                setHasAdminCap(false);
            }
        };

        checkAdminCap();
    }, [currentAccount, suiClient]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateForm = (): boolean => {
        if (!formData.latitude || !formData.longitude || !formData.label) {
            addNotification('error', 'Please fill in all required fields');
            return false;
        }

        const lat = parseFloat(formData.latitude);
        const lng = parseFloat(formData.longitude);

        if (isNaN(lat) || isNaN(lng)) {
            addNotification('error', 'Please enter valid numeric coordinates');
            return false;
        }

        if (lat < -90 || lat > 90) {
            addNotification('error', 'Latitude must be between -90 and 90');
            return false;
        }

        if (lng < -180 || lng > 180) {
            addNotification('error', 'Longitude must be between -180 and 180');
            return false;
        }

        return true;
    };

    const createCheckpoint = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentAccount || !adminCapId) {
            addNotification('error', 'Admin access required');
            return;
        }

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            // Create metadata object with location and details
            const metadata = {
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
                description: formData.description,
                image_url: formData.image_url,
                created_at: new Date().toISOString(),
                created_by: currentAccount.address,
                type: 'checkpoint_metadata',
                version: '1.0'
            };

            addNotification('info', 'Uploading metadata to Walrus...');

            // Upload metadata to Walrus and get the actual blob ID
            const walrusResult = await uploadJSON(metadata, 10); // Store for 10 epochs
            const metaWalrusId = walrusResult.blobId;
            const sealRef = walrusResult.suiRef;

            addNotification('success', `Metadata uploaded to Walrus: ${metaWalrusId.slice(0, 8)}...`);

            const transaction = new Transaction();
            const moveTarget = `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::checkpoint::create_checkpoint`;

            transaction.moveCall({
                target: moveTarget,
                arguments: [
                    transaction.object(adminCapId),
                    transaction.pure.string(formData.label),
                    transaction.pure.string(metaWalrusId),
                    transaction.pure.string(sealRef)
                ]
            });

            await new Promise((resolve, reject) => {
                signAndExecuteTransaction(
                    { transaction },
                    {
                        onSuccess: (result) => {
                            console.log('Checkpoint creation successful:', result);
                            addNotification('success', `Checkpoint "${formData.label}" created successfully!`);

                            // Reset form
                            setFormData({
                                latitude: '',
                                longitude: '',
                                label: '',
                                description: '',
                                image_url: ''
                            });

                            // Refresh the checkpoints list
                            refetchCheckpoints();

                            resolve(result);
                        },
                        onError: (error) => {
                            console.error('Checkpoint creation failed:', error);
                            addNotification('error', 'Failed to create checkpoint. Please try again.');
                            reject(error);
                        }
                    }
                );
            });

        } catch (error) {
            console.error('Error creating checkpoint:', error);
            addNotification('error', 'An error occurred while creating the checkpoint.');
        } finally {
            setIsLoading(false);
        }
    };

    const createAdminCap = async () => {
        if (!currentAccount) return;

        setIsLoading(true);
        try {
            const transaction = new Transaction();
            const moveTarget = `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::checkpoint::create_admin_cap`;

            transaction.moveCall({
                target: moveTarget,
                arguments: []
            });

            await new Promise((resolve, reject) => {
                signAndExecuteTransaction(
                    { transaction },
                    {
                        onSuccess: (result) => {
                            console.log('Admin cap creation successful:', result);
                            addNotification('success', 'Admin capabilities granted!');
                            setHasAdminCap(true);
                            resolve(result);
                        },
                        onError: (error) => {
                            console.error('Admin cap creation failed:', error);
                            addNotification('error', 'Failed to create admin capabilities.');
                            reject(error);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error creating admin cap:', error);
            addNotification('error', 'An error occurred while creating admin capabilities.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleCheckpoint = async (checkpointId: string, currentlyActive: boolean) => {
        if (!currentAccount || !adminCapId) {
            addNotification('error', 'Admin access required');
            return;
        }

        setIsLoading(true);
        try {
            const transaction = new Transaction();
            const moveTarget = `${process.env.NEXT_PUBLIC_SUIMMING_PACKAGE_ID}::checkpoint::toggle_checkpoint`;

            transaction.moveCall({
                target: moveTarget,
                arguments: [
                    transaction.object(adminCapId),
                    transaction.object(checkpointId),
                    transaction.pure.bool(!currentlyActive)
                ]
            });

            await new Promise((resolve, reject) => {
                signAndExecuteTransaction(
                    { transaction },
                    {
                        onSuccess: (result) => {
                            console.log('Checkpoint toggle successful:', result);
                            addNotification('success', `Checkpoint ${!currentlyActive ? 'activated' : 'deactivated'} successfully!`);
                            refetchCheckpoints();
                            resolve(result);
                        },
                        onError: (error) => {
                            console.error('Checkpoint toggle failed:', error);
                            addNotification('error', 'Failed to toggle checkpoint status.');
                            reject(error);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error toggling checkpoint:', error);
            addNotification('error', 'An error occurred while toggling checkpoint status.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderCheckpointsList = () => {
        if (checkpointsLoading) {
            return (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading checkpoints...</span>
                </div>
            );
        }

        if (checkpointsError) {
            return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-red-800 font-medium">Error loading checkpoints</h4>
                            <p className="text-red-600 text-sm mt-1">{checkpointsError}</p>
                        </div>
                        <button
                            onClick={refetchCheckpoints}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        if (checkpoints.length === 0) {
            return (
                <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <p className="text-gray-600">No checkpoints created yet.</p>
                    <p className="text-gray-500 text-sm mt-1">Create your first checkpoint using the form above.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {checkpoints.map((checkpoint, index) => (
                    <div key={checkpoint.id} className="bg-gray-50 rounded-lg p-4 border">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h4 className="font-semibold text-gray-900">{checkpoint.label}</h4>
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                        checkpoint.active
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {checkpoint.active ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                        #{index + 1}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-500">Coordinates:</span>
                                        <p className="font-mono text-gray-900">
                                            {checkpoint.lat.toFixed(6)}, {checkpoint.lng.toFixed(6)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Checkpoint ID:</span>
                                        <p className="font-mono text-gray-900 text-xs">
                                            {checkpoint.id.slice(0, 12)}...{checkpoint.id.slice(-8)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Walrus Blob ID:</span>
                                        <p className="font-mono text-gray-900 text-xs">
                                            {checkpoint.metaWalrusId.slice(0, 12)}...{checkpoint.metaWalrusId.slice(-8)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Seal Reference:</span>
                                        <p className="font-mono text-gray-900 text-xs">
                                            {checkpoint.sealRef.slice(0, 12)}...{checkpoint.sealRef.slice(-8)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 ml-4">
                                <button
                                    onClick={() => toggleCheckpoint(checkpoint.id, checkpoint.active)}
                                    disabled={isLoading}
                                    className={`px-3 py-1 text-xs rounded transition-colors disabled:opacity-50 ${
                                        checkpoint.active
                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                                    }`}
                                >
                                    {checkpoint.active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${checkpoint.lat}, ${checkpoint.lng}`);
                                        addNotification('success', 'Coordinates copied to clipboard!');
                                    }}
                                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
                                >
                                    Copy Coords
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (!currentAccount) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Admin Panel</h2>
                    <p className="text-gray-600 mb-6">Please connect your wallet to access admin functions.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    if (hasAdminCap === null) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Checking admin permissions...</p>
                </div>
            </div>
        );
    }

    if (!hasAdminCap) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Admin Access Required</h2>
                    <p className="text-gray-600 mb-6">You don&apos;t have admin capabilities. Request admin access or create admin capabilities if you&apos;re the deployer.</p>

                    <div className="space-y-4">
                        <button
                            onClick={createAdminCap}
                            disabled={isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                        >
                            {isLoading ? 'Creating...' : 'Create Admin Capabilities'}
                        </button>

                        <button
                            onClick={() => router.push('/')}
                            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Checkpoint Admin Panel</h1>
                    <p className="mt-2 text-gray-600">Create and manage checkpoints for the Suimming game</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Create Checkpoint Form */}
                    <div>
                        <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Checkpoint</h2>
                            <form onSubmit={createCheckpoint} className="space-y-6">
                        {/* Latitude */}
                        <div>
                            <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">
                                Latitude *
                            </label>
                            <div className="mt-1">
                                <input
                                    id="latitude"
                                    name="latitude"
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={handleInputChange}
                                    placeholder="e.g., 37.7749"
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Enter latitude in decimal degrees (-90 to 90)</p>
                        </div>

                        {/* Longitude */}
                        <div>
                            <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">
                                Longitude *
                            </label>
                            <div className="mt-1">
                                <input
                                    id="longitude"
                                    name="longitude"
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={handleInputChange}
                                    placeholder="e.g., -122.4194"
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Enter longitude in decimal degrees (-180 to 180)</p>
                        </div>

                        {/* Label */}
                        <div>
                            <label htmlFor="label" className="block text-sm font-medium text-gray-700">
                                Checkpoint Label *
                            </label>
                            <div className="mt-1">
                                <input
                                    id="label"
                                    name="label"
                                    type="text"
                                    value={formData.label}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Golden Gate Bridge"
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    maxLength={100}
                                    required
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                Description
                            </label>
                            <div className="mt-1">
                                <textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Describe this checkpoint location..."
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    maxLength={500}
                                />
                            </div>
                        </div>

                        {/* Image URL */}
                        <div>
                            <label htmlFor="image_url" className="block text-sm font-medium text-gray-700">
                                Image URL
                            </label>
                            <div className="mt-1">
                                <input
                                    id="image_url"
                                    name="image_url"
                                    type="url"
                                    value={formData.image_url}
                                    onChange={handleInputChange}
                                    placeholder="https://example.com/image.jpg"
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Current Position Helper */}
                        <div className="bg-blue-50 p-4 rounded-md">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-blue-800">
                                    Tip: You can get coordinates by visiting the map and noting your current location, or using online coordinate tools.
                                </span>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Creating Checkpoint...' : 'Create Checkpoint'}
                            </button>
                                </div>
                            </form>

                            {/* Navigation */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <div className="flex justify-between">
                                    <button
                                        onClick={() => router.push('/')}
                                        className="text-sm text-gray-600 hover:text-gray-900"
                                    >
                                        ← Back to Home
                                    </button>
                                    <button
                                        onClick={() => router.push('/map')}
                                        className="text-sm text-blue-600 hover:text-blue-900"
                                    >
                                        View Map →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Checkpoint List */}
                    <div>
                        <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-gray-900">Registered Checkpoints</h2>
                                <button
                                    onClick={refetchCheckpoints}
                                    disabled={checkpointsLoading}
                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {checkpointsLoading ? 'Loading...' : 'Refresh'}
                                </button>
                            </div>

                            {renderCheckpointsList()}
                        </div>
                    </div>
                </div>

                {/* Bottom Navigation */}
                <div className="mt-8 flex justify-center">
                    <div className="flex gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 flex items-center"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Home
                        </button>
                        <button
                            onClick={() => router.push('/map')}
                            className="px-4 py-2 text-blue-600 hover:text-blue-900 flex items-center"
                        >
                            View Map
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => router.push('/checkpoints')}
                            className="px-4 py-2 text-green-600 hover:text-green-900 flex items-center"
                        >
                            View All Coordinates
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}