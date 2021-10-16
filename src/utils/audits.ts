import * as models from '../models';
import { Transaction } from 'sequelize';

interface AuditParameters {
  userId: number,
  targetId: number;
  description: string;
  payload?: object;
}

export const saveAudit = async (props: AuditParameters, options?: { transaction: Transaction } ): Promise<void> => {
  const {
    userId,
    targetId,
    description,
    payload,
  } = props;

  return models.AuditActivity.create({
    userId: userId,
    targetId: targetId,
    description: description,
    ...(payload && { payload: JSON.stringify(payload) }),
    occurredAt: new Date(),
  }, options || {});
};
