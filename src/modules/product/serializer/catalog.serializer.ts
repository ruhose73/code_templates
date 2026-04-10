import { ICatalog } from '../../../clients/mongo/models/catalog.model';
import { CatalogDto } from '../dto/catalog.dto';

export const serializeCatalog = (catalog: ICatalog): CatalogDto => ({
  id: String(catalog._id),
  name: catalog.name,
  description: catalog.description,
});
