import axios from 'axios';
import { TokenTracker } from "../utils/token-tracker";
import { ReadResponse } from '../types';
import { JINA_API_KEY } from "../config";

export async function readUrl(
  url: string,
  withAllLinks?: boolean,
  tracker?: TokenTracker
): Promise<{ response: ReadResponse }> {
  if (!url.trim()) {
    throw new Error('URL cannot be empty');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Invalid URL, only http and https URLs are supported');
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${JINA_API_KEY}`,
    'Content-Type': 'application/json',
    'X-Retain-Images': 'none',
    'X-Md-Link-Style': 'discarded',
  };

  if (withAllLinks) {
    headers['X-With-Links-Summary'] = 'all';
  }

  try {
    // Use axios which handles encoding properly
    const { data } = await axios.post<ReadResponse>(
      'https://r.jina.ai/',
      { url },
      {
        headers,
        timeout: 60000,
        responseType: 'json'
      }
    );

    if (!data.data) {
      throw new Error('Invalid response data');
    }

    console.log('Read:', {
      title: data.data.title,
      url: data.data.url,
      tokens: data.data.usage?.tokens || 0
    });

    const tokens = data.data.usage?.tokens || 0;
    const tokenTracker = tracker || new TokenTracker();
    tokenTracker.trackUsage('read', {
      totalTokens: tokens,
      promptTokens: url.length,
      completionTokens: tokens
    });

    return { response: data };
  } catch (error) {
    // Handle axios errors with better type safety
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const status = error.response.status;
        const errorData = error.response.data as any;

        if (status === 402) {
          throw new Error(errorData?.readableMessage || 'Insufficient balance');
        }
        throw new Error(errorData?.readableMessage || `HTTP Error ${status}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response received from server');
      } else {
        // Something happened in setting up the request
        throw new Error(`Request failed: ${error.message}`);
      }
    }
    // For non-axios errors
    throw error;
  }
}