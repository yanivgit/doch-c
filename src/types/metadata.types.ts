export interface BattalionMetadata {
  equipmentTypes: string[];
  platoons: string[];
  locations: {
    [platoon: string]: string[];
  };
}

export type MetadataCategory = 'equipment' | 'platoon' | 'location';
