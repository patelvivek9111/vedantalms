import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { REGRESSION_UI_IDS, RegressionControl } from '@/regression/InventoryUiRegistry';

describe('regression inventory UI', () => {
  it.each(REGRESSION_UI_IDS.map((id) => [id]))(
    'inventory-ui:%s exposes data-regression-id control',
    (regressionId) => {
      render(<RegressionControl id={regressionId} label={regressionId} />);
      expect(screen.getByRole('button', { name: regressionId })).toHaveAttribute(
        'data-regression-id',
        regressionId
      );
    }
  );
});
