import {
  cardValidators,
  SetDefaultCardBodySchema,
} from "@/modules/cards/utils/card.validation";
import z from "zod";

// Controller types
export type TCardController = typeof cardValidators;

// Interfaces/Types from Schemas
export type TSetDefaultCardParams = z.infer<typeof SetDefaultCardBodySchema>;

export interface ICardListResponse {
  cards: any[];
  defaultPaymentMethodId?: string | null;
}
