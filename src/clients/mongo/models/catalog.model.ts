import { Schema, Types } from 'mongoose';

export const CATALOG_MODEL = 'Catalog';

export interface ICatalog {
  _id: Types.ObjectId;
  name: string;
  description: string;
}

export const CatalogSchema = new Schema<ICatalog>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
  },
  { timestamps: true },
);
