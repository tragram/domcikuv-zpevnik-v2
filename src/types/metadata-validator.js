// metadata-validator.js
// This utility helps validate that metadata fields stay in sync

import { preambleKeywords, generatedFields, JS2chordproKeywords } from './preambleKeywords.js';

/**
 * Validates that all metadata definitions are in sync:
 * - preambleKeywords contains all fields in JS2chordproKeywords
 * - SongRawData interface has all necessary fields
 */
export function validateMetadataDefinitions() {
  const errors = [];

  // Check 1: Make sure all JS2chordproKeywords values are in preambleKeywords
  const missingPreambleFields = Object.values(JS2chordproKeywords)
    .filter(value => !preambleKeywords.includes(value));
  
  if (missingPreambleFields.length > 0) {
    errors.push(`Missing fields in preambleKeywords: ${missingPreambleFields.join(', ')}`);
  }

  // Check 2: Make sure all preambleKeywords have corresponding JS2chordproKeywords keys
  const jsKeys = Object.values(JS2chordproKeywords);
  const missingJSKeys = preambleKeywords
    .filter(keyword => !jsKeys.includes(keyword));
  
  if (missingJSKeys.length > 0) {
    errors.push(`preambleKeywords without JS mapping: ${missingJSKeys.join(', ')}`);
  }

  // Return results
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Utility to check a specific SongRawData object
 * against the expected fields from our definitions
 */
export function validateSongObject(songObject) {
  const errors = [];
  
  // Get all expected fields
  const expectedFields = [
    ...Object.keys(JS2chordproKeywords),
    ...generatedFields
  ];
  
  // Check for missing expected fields
  const missingFields = expectedFields
    .filter(field => !(field in songObject));
  
  if (missingFields.length > 0) {
    errors.push(`Missing expected fields: ${missingFields.join(', ')}`);
  }
  
  // Check for extra fields
  const extraFields = Object.keys(songObject)
    .filter(field => !expectedFields.includes(field) && field !== 'content');
  
  if (extraFields.length > 0) {
    errors.push(`Extra fields not in definitions: ${extraFields.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}