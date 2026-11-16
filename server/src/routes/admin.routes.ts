import { Router, Request, Response } from 'express';
import { UserDataResetService } from '../services/admin/userDataReset.service';

const router = Router();

export const EXPECTED_RESET_CONFIRMATION = 'CONFIRM_DELETE_ALL_USER_DATA';

/**
 * GET /api/admin/data-summary
 * Get current record counts across all user data stores and shared catalogue
 */
router.get('/data-summary', (_req: Request, res: Response): void => {
  try {
    const summary = UserDataResetService.getDataSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve data summary',
      error: err.message
    });
  }
});

/**
 * POST /api/admin/reset-user-data
 * Destructive endpoint requiring explicit safety confirmation
 */
router.post('/reset-user-data', async (req: Request, res: Response): Promise<void> => {
  try {
    const { confirmation } = req.body || {};

    if (confirmation !== EXPECTED_RESET_CONFIRMATION) {
      res.status(400).json({
        success: false,
        message: `Safety check failed. Exact confirmation string required: "${EXPECTED_RESET_CONFIRMATION}"`,
        requiredConfirmation: EXPECTED_RESET_CONFIRMATION
      });
      return;
    }

    const report = await UserDataResetService.resetAllUserData();

    res.json({
      success: true,
      message: 'User data deletion completed successfully. Application is fresh for new users.',
      report
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to reset user data',
      error: err.message
    });
  }
});

export default router;
