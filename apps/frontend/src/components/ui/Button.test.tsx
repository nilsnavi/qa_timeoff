import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './index';

describe('Button', () => {
  it('рендерит текст кнопки', () => {
    render(<Button>Нажать</Button>);
    expect(screen.getByText('Нажать')).toBeInTheDocument();
  });

  it('вызывает onClick при клике', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Клик</Button>);
    fireEvent.click(screen.getByText('Клик'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('не вызывает onClick когда disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    fireEvent.click(screen.getByText('Disabled'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('применяет variant классы', () => {
    const { container } = render(<Button variant="danger">Опасность</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-rose-500');
  });

  it('применяет size классы', () => {
    const { container } = render(<Button size="lg">Большая</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('min-h-14');
  });
});
