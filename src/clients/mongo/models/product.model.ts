import { Schema, Types } from 'mongoose';

export const PRODUCT_MODEL = 'Product';

export interface IProduct {
  _id: Types.ObjectId;
  catalogId: Types.ObjectId;
  name: string;
  description: string;
  price: number;
  quantity: number;
  attributes: Record<string, unknown>;
  createdAt: Date;
}

export const ProductSchema = new Schema<IProduct>(
  {
    catalogId: { type: Schema.Types.ObjectId, ref: 'Catalog', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    attributes: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
