// Validation utility functions for metadata fields

export type ValidationResult = {
    isValid: boolean;
    errorMessage?: string;
  };
  
  export type FieldValidators = {
    [key: string]: (value: string) => ValidationResult;
  };
  
  // Validator for required fields
  export const requiredValidator = (fieldName: string) => (value: string): ValidationResult => {
    return {
      isValid: value.trim().length > 0,
      errorMessage: value.trim().length === 0 ? `${fieldName} is required` : undefined,
    };
  };
  
  // Validator for date format (MM-YYYY)
  export const dateFormatValidator = (value: string): ValidationResult => {
    if (!value.trim()) return { isValid: true }; // Optional field
    
    const regex = /^(0[1-9]|1[0-2])-\d{4}$/;
    return {
      isValid: regex.test(value),
      errorMessage: regex.test(value) ? undefined : 'Date must be in MM-YYYY format (e.g. 02-2025)',
    };
  };
  
  // Validator for numeric fields
  export const numericValidator = (fieldName: string) => (value: string): ValidationResult => {
    if (!value.trim()) return { isValid: true }; // Optional field
    
    const isNumeric = !isNaN(Number(value)) && !isNaN(parseFloat(value));
    return {
      isValid: isNumeric,
      errorMessage: isNumeric ? undefined : `${fieldName} must be a number`,
    };
  };
  
  // Validator for key format
  export const keyValidator = (value: string): ValidationResult => {
    if (!value.trim()) return { isValid: true }; // Optional field
    
    // Basic regex for key validation (e.g., C, C#, Dm, Ami)
    const regex = /^[A-H][#b]?(m|mi)?$/;
    return {
      isValid: regex.test(value),
      errorMessage: regex.test(value) ? undefined : 'Invalid key format (e.g., use C, C#, Dm, Ami)',
    };
  };
  
  // Validator for JSON array format (songbooks)
  export const jsonArrayValidator = (value: string): ValidationResult => {
    if (!value.trim()) return { isValid: true }; // Optional field
    
    try {
      const parsed = JSON.parse(value);
      const isArray = Array.isArray(parsed);
      return {
        isValid: isArray,
        errorMessage: isArray ? undefined : 'Must be a valid JSON array',
      };
    } catch (error) {
      return {
        isValid: false,
        errorMessage: 'Invalid JSON format. Use ["Item1", "Item2"] format',
      };
    }
  };
  
  // Validator for vocal range format (e.g., c1-g2)
  export const rangeValidator = (value: string): ValidationResult => {
    if (!value.trim()) return { isValid: true }; // Optional field
    
    // Range format: note+octave-note+octave (e.g., c1-g2)
    const regex = /^[a-h][#b]?\d+-[a-h][#b]?\d+$/;
    return {
      isValid: regex.test(value),
      errorMessage: regex.test(value) ? undefined : 'Range must be in format: note+octave-note+octave (e.g., c1-g2)',
    };
  };
  
  // Define validators for all metadata fields
  export const metadataValidators: FieldValidators = {
    title: requiredValidator('Title'),
    artist: requiredValidator('Artist'),
    key: keyValidator,
    dateAdded: dateFormatValidator,
    songbooks: jsonArrayValidator,
    capo: numericValidator('Capo'),
    tempo: numericValidator('Tempo'),
    range: rangeValidator,
    // Simple validators for remaining fields (optional text fields)
    language: (value) => ({ isValid: true }),
    startMelody: (value) => ({ isValid: true }),
    pdfFilenames: (value) => ({ isValid: true }),
  };
  
  // Function to validate all metadata at once
  export const validateMetadata = (metadata: Record<string, string>): Record<string, ValidationResult> => {
    const validationResults: Record<string, ValidationResult> = {};
    
    Object.keys(metadata).forEach(field => {
      if (metadataValidators[field]) {
        validationResults[field] = metadataValidators[field](metadata[field]);
      } else {
        validationResults[field] = { isValid: true };
      }
    });
    
    return validationResults;
  };